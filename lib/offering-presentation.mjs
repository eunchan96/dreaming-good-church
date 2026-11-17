/** @param {import('./bulletins').BlockContent} content */
export function offeringSummary(content,body=''){
 const match=body.match(/\((\d+)주\)/),month=Number(content.month?.slice(5,7));
 let weeks=match?Number(match[1]):0;
 if(!weeks&&content.month&&/^\d{4}-\d{2}$/.test(content.month)){const [year,m]=content.month.split('-').map(Number);for(let day=1;day<=new Date(year,m,0).getDate();day++)if(new Date(year,m-1,day).getDay()===0)weeks++;}
 return `${month?month+'월':''}${weeks?'('+weeks+'주)':''} 총계`;
}
/** @param {import('./bulletins').BlockContent} content
 * @returns {import('./bulletins').BlockContent} */
export function offeringRows(content){
 const indices=(content.rows??[]).map((_,i)=>i).sort((a,b)=>Number(/월삭\s*감사/.test(content.rows[a][0]))-Number(/월삭\s*감사/.test(content.rows[b][0])));
 return {...content,rows:indices.map(i=>content.rows[i]),disabledRows:indices.flatMap((old,i)=>content.disabledRows?.includes(old)?[i]:[])};
}
