import { PageHeader } from "@/components/ui";
import { ContactForm } from "../ContactForm";
import { createContact } from "../actions";

export const metadata = { title: "Novo contato" };

export default async function NewContact({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <PageHeader title="Novo contato" />
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "dup" ? "Já existe um contato com este telefone." : "Telefone inválido. Use DDD + número."}
        </p>
      )}
      <div className="card max-w-3xl p-6">
        <ContactForm action={createContact} submitLabel="Salvar contato" />
      </div>
    </>
  );
}
