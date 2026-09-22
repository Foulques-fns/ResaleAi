import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
const hasGoogle = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const authOptions = {
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    providers: hasGoogle
        ? [
            GoogleProvider({
                clientId: process.env.AUTH_GOOGLE_ID,
                clientSecret: process.env.AUTH_GOOGLE_SECRET,
                authorization: {
                    params: {
                        prompt: "select_account",
                        scope: "openid email profile",
                    },
                },
            }),
        ]
        : [],
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account)
                token.provider = account.provider;
            if (profile && typeof profile === "object") {
                const p = profile;
                if (typeof p.picture === "string")
                    token.picture = p.picture;
                if (typeof p.email_verified === "boolean")
                    token.emailVerified = p.email_verified;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && typeof token.picture === "string") {
                session.user.image = token.picture;
            }
            return {
                ...session,
                provider: typeof token.provider === "string" ? token.provider : null,
                emailVerified: typeof token.emailVerified === "boolean" ? token.emailVerified : null,
            };
        },
    },
};
export function auth() {
    return getServerSession(authOptions);
}
export const authCapabilities = {
    google: hasGoogle,
};
