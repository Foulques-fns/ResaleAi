import { auth, authCapabilities } from "@/auth";
export const dynamic = "force-dynamic";
export async function GET() {
    const session = await auth();
    return Response.json({
        authenticated: !!session?.user,
        user: session?.user
            ? {
                name: session.user.name ?? null,
                email: session.user.email ?? null,
                image: session.user.image ?? null,
            }
            : null,
        provider: session?.provider ?? null,
        emailVerified: session?.emailVerified ?? null,
        providers: {
            google: authCapabilities.google,
        },
    });
}
