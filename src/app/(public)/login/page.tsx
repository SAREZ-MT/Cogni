import { Button } from "@/shared/ui/button";

const fieldClassName =
  "h-11 w-full rounded-input border border-border-default bg-card px-3 text-fg text-sm placeholder:text-fg-muted";

// Placeholder Server Action: keeps the form on POST so credentials never
// reach the URL. PR3 (task 3.10) replaces it with the real sign-in action.
async function signInPlaceholder(): Promise<void> {
  "use server";
}

export default function LoginPage() {
  return (
    <form action={signInPlaceholder} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl text-fg">Inicia sesión</h1>
        <p className="text-fg-secondary text-sm">
          Bienvenido de vuelta a Cogni.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="font-medium text-fg text-sm">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={fieldClassName}
          placeholder="tu@correo.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="font-medium text-fg text-sm">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={fieldClassName}
        />
      </div>

      <Button type="submit" size="lg" className="w-full">
        Iniciar sesión
      </Button>
    </form>
  );
}
