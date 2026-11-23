export const PREVIEW_ORIGIN='https://dreaming-good-church-git-codex-bulle-a36b08-eunchan96s-projects.vercel.app';
export const PRODUCTION_ORIGIN='https://dreaming-towb-church.vercel.app';
// 이름을 바꾸기 전 운영 주소. 이미 발급·등록된 링크가 깨지지 않도록 당분간 함께 허용한다.
export const LEGACY_PRODUCTION_ORIGIN='https://dreaming-good-church.vercel.app';
const origins=new Set([PRODUCTION_ORIGIN,LEGACY_PRODUCTION_ORIGIN,PREVIEW_ORIGIN,...['localhost','127.0.0.1'].flatMap((host)=>[3000,3001].map((port)=>`http://${host}:${port}`))]);

export function accountUrl(origin) {
  const url=new URL(origin);
  if(!origins.has(url.origin)||url.username||url.password||url.pathname!=='/'||url.search||url.hash) throw new Error('Choose an approved account origin.');
  return `${url.origin}/admin/account`;
}

/** @returns {'invite'|'recovery'} */
export function accountLinkType(value) {
  if(value!=='invite'&&value!=='recovery') throw new Error('Invalid account link type.');
  return value;
}

export function parseAccountHash(hash) {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const token=params.get('token_hash');
  const type=accountLinkType(params.get('type')??'invite');
  if(params.getAll('token_hash').length!==1||params.getAll('type').length>1||!token||!/^[A-Za-z0-9_-]{16,512}$/.test(token)) throw new Error('Invalid account link.');
  return {token,type};
}

export function makeAccountLink(origin,token,type='invite') {
  const base=accountUrl(origin);
  const params=new URLSearchParams({token_hash:token,type:accountLinkType(type)});
  parseAccountHash(params.toString());
  return `${base}#${params}`;
}

export const escapeHtml=(text)=>text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll("'",'&#39;');
