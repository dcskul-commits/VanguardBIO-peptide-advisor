// WP07: authorization is server-side and session-derived. No client-supplied identity or role.
// "member" means verified email + active Better Auth session, not a paid subscription.
export function memberWorkspaceDecision(session) {
  const user=session?.user;
  if(!session?.session || !user?.id || user.emailVerified!==true) {
    return {allowed:false,status:401};
  }
  return {allowed:true,status:200,
    body:{member:{id:user.id,emailVerified:true},access:{memberWorkspace:true,paidFeatures:false}}
  };
}
