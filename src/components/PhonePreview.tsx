import { ExternalLink, Reply } from "lucide-react";

/** Pré-visualização da mensagem como o cliente verá no WhatsApp */
export function PhonePreview({ body, headerImage, urlButton, quickReplies, name = "Maria", compact }: { body: string; headerImage?: string | null; urlButton: boolean; quickReplies: string[]; name?: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl bg-[#e9e2d6] p-3 ${compact ? "" : "self-start"}`} style={{ backgroundImage: "radial-gradient(#d9cfbf 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
      <div className="max-w-[300px] overflow-hidden rounded-lg rounded-tl-none bg-white text-[13px] shadow-sm">
        {headerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={headerImage} alt="" className="h-36 w-full object-cover" />
        )}
        <p className="px-3 pt-2 pb-1 whitespace-pre-line text-ink">{body.replaceAll("{{1}}", name)}</p>
        <p className="px-3 pb-1.5 text-right text-[10px] text-muted">10:42</p>
        {urlButton && (
          <div className="flex items-center justify-center gap-1.5 border-t border-line py-2 font-medium text-[#0a7cff]">
            <ExternalLink size={14} /> Ver catálogo
          </div>
        )}
        {quickReplies.map((q) => (
          <div key={q} className="flex items-center justify-center gap-1.5 border-t border-line py-2 font-medium text-[#0a7cff]">
            <Reply size={14} /> {q}
          </div>
        ))}
      </div>
    </div>
  );
}
