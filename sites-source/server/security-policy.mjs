// Build-time policy shared by the hosted development pages and portable export.
// Frozen routes retain their existing response headers.
export function salaryMateCsp({scriptHashes=[],marketOrigin='',portable=false}={}) {
  const scripts=portable?scriptHashes:["'self'"];
  if(portable&&!scriptHashes.length)throw new Error('Portable scripts require CSP hashes');
  if(marketOrigin&&(!/^https:\/\//.test(marketOrigin)||new URL(marketOrigin).origin!==marketOrigin))throw new Error('Invalid market origin');
  const policy=[
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    `script-src ${scripts.join(' ')} https://accounts.google.com/gsi/client`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${marketOrigin?' '+marketOrigin:''} https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com/gsi/`,
    "frame-src https://accounts.google.com/gsi/",
    "form-action 'self' https://accounts.google.com",
    `worker-src ${portable?"'none'":"'self'"}`,
    "manifest-src 'self'"
  ];
  // frame-ancestors is enforced only in HTTP headers, not in an HTML meta tag.
  if(!portable)policy.push("frame-ancestors 'self' https://chatgpt.com");
  return policy.join('; ');
}
