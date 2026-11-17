import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-black text-ember-600/40">404</p>
      <h1 className="mt-3 text-xl font-extrabold text-ember-50">Page not found</h1>
      <p className="mt-2 text-sm text-ember-100/55">
        That page does not exist. Head back and buy some data.
      </p>
      <Link href="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}
