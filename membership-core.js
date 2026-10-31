import { betterAuth } from 'better-auth';

// One source of truth for live staging and isolated CI tests. Email callbacks
// intentionally delegate to a provided sender; no real addresses are logged.
export function buildMembershipAuth({database,baseURL,secret,trustedOrigins,sendEmail}) {
  return betterAuth({
    baseURL,secret,database,trustedOrigins,
    emailAndPassword:{
      enabled:true,requireEmailVerification:true,minPasswordLength:12,
      sendResetPassword: async ({user,url})=>sendEmail({to:user.email,subject:'VanguardBio-You password reset',url})
    },
    emailVerification:{
      sendOnSignUp:true,sendOnSignIn:true,
      sendVerificationEmail: async ({user,url})=>sendEmail({to:user.email,subject:'Verify your VanguardBio-You email',url})
    },
    advanced:{defaultCookieAttributes:{secure:true,httpOnly:true,sameSite:'none'}},
    rateLimit:{enabled:true,window:60,max:30}
  });
}
