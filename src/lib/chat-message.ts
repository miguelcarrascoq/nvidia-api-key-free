import type { FinishReason, UIMessage } from 'ai';

export type ChatMessageMetadata = {
  finishReason?: FinishReason;
};

export type ChatUIMessage = UIMessage<ChatMessageMetadata>;
