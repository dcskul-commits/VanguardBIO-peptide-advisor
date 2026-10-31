// Staging-only email sender. Never log addresses, links, credentials, or provider response bodies.
// Better Auth defaults to redirecting verification clicks to "/" if no callback is supplied.
// This service has no root page, so supply an explicit, same-origin confirmation page.
const STAGING_ORIGIN = 'https://vanguardbio-peptide-advisor-staging.onrender.com';
export function membershipEmailLink(url,subject) {
  if(subject!=='Verify your VanguardBio-You email')return url;
  const link=new URL(url);
  if(link.origin!==STAGING_ORIGIN || link.pathname!=='/api/auth/verify-email' || !link.searchParams.get('token'))
    throw Error('Unexpected staging verification link target');
  link.searchParams.set('callbackURL',STAGING_ORIGIN+'/membership/verified');
  return link.toString();
}
export async function sendMembershipEmail({to,subject,url}, env=process.env) {
  if (!env.RESEND_API_KEY || !env.MEMBERSHIP_EMAIL_FROM) throw Error('email delivery not configured');
  const verifiedLink=membershipEmailLink(url,subject);
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body: JSON.stringify({from:env.MEMBERSHIP_EMAIL_FROM,to:[to],subject,text:`To complete your VanguardBio-You request, open this link:\n\n${verifiedLink}\n\nIf you did not request this, ignore this message.`}),
    signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error('email delivery failed');
}
