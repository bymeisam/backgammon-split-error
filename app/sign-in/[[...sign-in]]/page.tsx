import { SignIn } from "@clerk/nextjs";
import { style } from "../signIn.styles";

export default function SignInPage() {
  return (
    <main className={style.page}>
      <div className={style.shell}>
        <div className={style.brand}>
          <div className={style.mark} aria-hidden="true">
            <span className={style.markBack} />
            <span className={style.markFront} />
          </div>
          <p className={style.brandName}>Game Review</p>
          <p className={style.tagline}>A quiet study space for your matches, mistakes, and next move.</p>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          withSignUp={false}
          forceRedirectUrl="/auth/complete"
          appearance={{ elements: style.clerk }}
        />
        <p className={style.note}>Private access. Use the email address that received your invitation.</p>
      </div>
    </main>
  );
}
