import { SignIn } from "@clerk/nextjs";
import { AUTH_COMPLETE_PATH, SIGN_IN_PATH } from "@/lib/clerkConfig";
import BrandMark from "@/app/components/ui/BrandMark";
import { style } from "../signIn.styles";

export default function SignInPage() {
  return (
    <main className={style.page}>
      <div className={style.shell}>
        <div className={style.brand}>
          <div className={style.mark} aria-hidden="true">
            <BrandMark className={style.markIcon} />
          </div>
          <p className={style.brandName}>Game Review</p>
          <p className={style.tagline}>A quiet study space for your matches, mistakes, and next move.</p>
        </div>
        <SignIn
          routing="path"
          path={SIGN_IN_PATH}
          withSignUp={false}
          forceRedirectUrl={AUTH_COMPLETE_PATH}
          appearance={{ elements: style.clerk }}
        />
        <p className={style.note}>Private access. Use the email address that received your invitation.</p>
      </div>
    </main>
  );
}
