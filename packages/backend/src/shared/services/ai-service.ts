import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { logger } from "../utils/logger";
import { UnifiedRecord } from "../types/unified-record";
import { dlqService } from "./dlq-service";

export class AiService {
    private client: BedrockRuntimeClient;
    private modelId = "anthropic.claude-3-haiku-20240307-v1:0";

    constructor() {
        this.client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-west-2" });
    }

    private getPromptForRecordType(recordType: string, content: Record<string, unknown>): string {
        const jsonContent = JSON.stringify(content, null, 2);

        switch (recordType) {
            case 'PROJECT':
                return `
Turn this project record into a short, friendly newsfeed update. Summarize what the project is about, note its current status, and add a brief piece of insight or encouragement. For example, if it's a 3D project, you might say: 'Great progress on the 3D map! Maybe next you could explore adding interactive elements.'

Record:
${jsonContent}
`;
            case 'NOTE':
                return `
Convert this note record into a concise newsfeed entry. Include the note's title and a quick summary of its content. Then offer a small reflection or suggestion, like: 'Interesting thought! You might want to tag this for future reference on similar topics.'

Record:
${jsonContent}
`;
            case 'THOUGHT':
                return `
Take this quick thought record and turn it into a brief, casual newsfeed item. Summarize the raw idea and add a little nudge or encouragement—like: 'Nice spark of inspiration! Consider expanding on this idea when you have a moment.'

Record:
${jsonContent}
`;
            case 'CAPTURE':
                return `
Transform this captured content into a newsfeed highlight. Mention the title and source, and provide a brief insight—like key takeaways or why it's interesting. For example: 'Just watched a great YouTube video on topic X—really insightful! You might want to dive deeper into [related topic].'

Record:
${jsonContent}
`;
            case 'LLM_CONVERSATION':
                return `
Summarize this LLM conversation into a newsfeed entry. Include what you asked and a key part of the AI's response. Then add a quick reflective comment, like: 'Interesting discussion! Maybe next time you could ask about [another angle].'

Record:
${jsonContent}
`;
            case 'SOLILOQUY':
                return `
Convert this voice note into a newsfeed snippet. Summarize the main point of what was said and add a friendly nudge—like: 'Nice reflection! It might be worth jotting this down as a note for later reference.'

Record:
${jsonContent}
`;
            case 'CONTACT':
                return `
Summarize this contact record into a brief newsfeed entry. Mention the person's name and role, and add a little note—like: 'Remember to follow up with this person next week about [topic].'

Record:
${jsonContent}
`;
            default:
                return `
Summarize the following record into a brief newsfeed entry and provide a short insight.

Record:
${jsonContent}
`;
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async generateEnrichment(record: UnifiedRecord): Promise<{ summary: string; insight: string }> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const prompt = this.getPromptForRecordType(record.record_type, record.content);

                const payload = {
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 300,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: prompt + "\n\nReturn the result as a raw JSON object with keys 'summary' and 'insight'. Do not include markdown formatting or explanations."
                                }
                            ]
                        }
                    ]
                };

                const command = new InvokeModelCommand({
                    modelId: this.modelId,
                    contentType: "application/json",
                    accept: "application/json",
                    body: JSON.stringify(payload)
                });

                const response = await this.client.send(command);
                const responseBody = JSON.parse(new TextDecoder().decode(response.body));
                const responseText = responseBody.content[0].text;

                // Clean up potential markdown code blocks if the model ignores instruction (robustness)
                const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

                try {
                    const parsed = JSON.parse(cleanJson);

                    // Check for empty/missing fields
                    if (!parsed.summary || !parsed.insight) {
                        // Don't send to DLQ for partial success, just log and use fallbacks
                        logger.warn("AI returned empty fields", {
                            recordId: record.original_id,
                            hasSummary: !!parsed.summary,
                            hasInsight: !!parsed.insight
                        });
                    }

                    return {
                        summary: parsed.summary || "Unable to generate summary.",
                        insight: parsed.insight || "Unable to generate insight."
                    };
                } catch (parseError) {
                    logger.warn(`Failed to parse AI response (attempt ${attempt}/${maxRetries})`, { responseText });
                    lastError = parseError as Error;

                    // For parse errors, retry immediately (might be transient model issue)
                    if (attempt < maxRetries) {
                        await this.delay(500 * attempt); // 500ms, 1000ms backoff
                        continue;
                    }

                    // After all retries failed, send to DLQ
                    await dlqService.sendToQueue(
                        record,
                        "INVALID_JSON_RESPONSE",
                        `Failed after ${maxRetries} attempts. Last error: ${lastError.message}. Raw: ${responseText.substring(0, 200)}`
                    );

                    return {
                        summary: "Unable to generate summary.",
                        insight: "Unable to generate insight."
                    };
                }

            } catch (error) {
                lastError = error as Error;
                logger.warn(`Bedrock API error (attempt ${attempt}/${maxRetries})`, { error: lastError.message });

                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s
                    await this.delay(1000 * attempt);
                    continue;
                }

                // After all retries failed, send to DLQ
                await dlqService.sendToQueue(
                    record,
                    "BEDROCK_API_ERROR",
                    `Failed after ${maxRetries} attempts. Last error: ${lastError.message}`
                );

                return {
                    summary: "Unable to generate summary.",
                    insight: "Unable to generate insight."
                };
            }
        }

        // Should never reach here, but TypeScript needs it
        return {
            summary: "Unable to generate summary.",
            insight: "Unable to generate insight."
        };
    }
}

export const aiService = new AiService();
