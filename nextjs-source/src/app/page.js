import { redirect } from "next/navigation";
/**
 * La racine redirige vers l'application web classique
 * (fichiers HTML/CSS/JS servis depuis /public/app).
 */
export default function RootPage() {
    redirect("/app/index.html");
}
