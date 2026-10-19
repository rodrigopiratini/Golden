import { MessageCircle } from "lucide-react";

export const metadata = { title: "Conversas" };

export default function ConversationsIndex() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-sm text-muted lg:flex">
      <MessageCircle size={36} className="text-gold" />
      Selecione uma conversa
    </div>
  );
}
