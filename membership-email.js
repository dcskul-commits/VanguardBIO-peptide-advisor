// Staging-only email sender. Never log addresses, links, credentials, or provider response bodies.
export async function sendMembershipEmail({to,subject,url}, env=process.env) {
  if (!env.RESEND_API_KEY || !env.MEMBERSHIP_EMAIL_FROM) throw Error('email delivery not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body: JSON.stringify({from:env.MEMBERSHIP_EMAIL_FROM,to:[to],subject,text:`To complete your VanguardBio-You request, open this link:\n\n${url}\n\nIf you did not request this, ignore this message.`}),
    signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error('email delivery failed');
}
