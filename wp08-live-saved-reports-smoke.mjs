// WP08-B live staging-only negative access smoke. No credentials or user data.
const base='https://vanguardbio-peptide-advisor-staging.onrender.com';
const expected='vanguardbio-peptide-advisor-staging.onrender.com';
if(new URL(base).hostname!==expected)throw Error('Staging-only service guard failed');
const cases=[
 {name:'anonymous_list_denied',path:'/api/member/reports',method:'GET',status:401},
 {name:'anonymous_read_denied',path:'/api/member/reports/123e4567-e89b-42d3-a456-426614174000',method:'GET',status:401},
 {name:'anonymous_create_denied',path:'/api/member/reports',method:'POST',origin:base,body:{title:'synthetic',body:'synthetic',explicitSave:true},status:401},
 {name:'no_origin_post_denied',path:'/api/member/reports',method:'POST',body:{title:'synthetic',body:'synthetic',explicitSave:true},status:403},
 {name:'production_origin_denied',path:'/api/member/reports',method:'GET',origin:'https://you.vanguardbio.ai',status:403},
 {name:'untrusted_origin_denied',path:'/api/member/reports',method:'GET',origin:'https://untrusted.example',status:403},
 {name:'unsupported_method_denied',path:'/api/member/reports',method:'PUT',origin:base,body:{},status:405},
];
for(const c of cases) {
 const opts={method:c.method,redirect:'manual',signal:AbortSignal.timeout(25000),headers:{}};
 if(c.origin)opts.headers.Origin=c.origin;
 if(c.body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(c.body);}
 const r=await fetch(base+c.path,opts);
 const body=await r.text();
 const ok=r.status===c.status && !body.includes('Synthetic educational report');
 console.log('WP08_STAGING_REPORT_SMOKE '+JSON.stringify({check:c.name,passed:ok,status:r.status}));
 if(!ok)throw Error('WP08 staging report access test failed: '+c.name);
}
console.log('WP08_STAGING_REPORT_SMOKE_COMPLETE '+JSON.stringify({passed:true,checks:cases.length,createdRecords:0}));
