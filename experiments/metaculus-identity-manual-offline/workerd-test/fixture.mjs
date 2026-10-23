// Entirely in-process synthetic service. No network or stored credentials.
export default {fetch(request){
 const u=new URL(request.url);
 if(u.pathname==='/redirect')return new Response(null,{status:302,headers:{Location:'https://unreachable.invalid/never-follow'}});
 if(u.pathname==='/never-follow')throw Error('redirect unexpectedly followed');
 if(request.headers.get('Cookie'))throw Error('unexpected cookie');
 return Response.json({id:800001,username:'SyntheticIdentityBot',is_bot:true});
}};
