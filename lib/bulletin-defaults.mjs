export const standingFooter='↑ 표시는 일어서서, 몸이 불편한 분은 앉아 계셔도 됩니다.';
export const defaultOrderRows=[
 ['↑ 하나님은 영이시니 예배하는 자가 영과 진리로 예배할지로다 아멘','',''],
 ['↑ 찬송','','다 같이'],['↑ 묵상기도','','다 같이'],['↑ 신앙고백','사도신경','다 같이'],['찬송','','다 같이'],['기도 인도','더 가까이',''],['특송','',''],['좋은 소식','','인도자'],['성경봉독','','다 같이'],['말씀 선포','','최선주 목사'],['봉헌 & 기도','헌금은 헌금함에 하시면 됩니다','인도자'],['↑ 결단 & 찬송','','다 같이'],['축도','','최선주 목사']
];
export const defaultStaffRows=[['담임 목사','최선주',''],['협동 전도사','유연학',''],['예배 찬양','방종혁 · 방은찬 · 최성민 · 유다은',''],['예배 반주','강준호 · 조용주 · 김소희 · 표재현',''],['영상･유튜브','윤채성 ･ 최민지',''],['토브 지휘자','강준호',''],['성경 봉독','조근혜',''],['교회 청소','','']];
export const defaultAccountBody='온라인 헌금계좌: 농협 301-0223-0182-71 좋은교회\n온라인 건축헌금: 농협 301-0220-0484-91 좋은교회';
export const defaultOfferingRows=['온라인 / 주일헌금','온라인 / 십일조','온라인 / 감사헌금','온라인 / 구제헌금','온라인 / 건축헌금','주일헌금','십일조','감사헌금','선교헌금','건축헌금','구제헌금','일천번제','월삭감사'].map(label=>[label,'']);
export const rowIdentity=value=>String(value??'').replace(/[↑\s·]/g,'');
const date=value=>new Date(value+'T12:00:00Z');
export function offsetDate(value,days){const d=date(value);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function shortDate(value){const d=date(value);return `${d.getUTCMonth()+1}/${d.getUTCDate()}`;}
export function volunteerDefaults(value){const d=date(value),saturday=offsetDate(value,(6-d.getUTCDay()+7)%7),sunday=offsetDate(value,(7-d.getUTCDay())||7);return [['교회 청소','',shortDate(saturday)],['기도 인도','',shortDate(sunday)]];}
export function shiftPrayerRows(rows,value,previousDate){const weeks=previousDate?Math.max(0,Math.round((date(value)-date(previousDate))/604800000)):1;return Array.from({length:5},(_,i)=>[shortDate(offsetDate(value,i*7)),rows?.[i+weeks]?.[1]??'',rows?.[i+weeks]?.[2]??'']);}
export function fixedOrderCell(row,column){const label=rowIdentity(row[0]);if(column===0)return true;if(column===2)return /^(다같이|인도자|최선주목사)$/.test(rowIdentity(row[2]));return label==='신앙고백'||label==='봉헌&기도'||label==='기도인도'||(!row[1]?.trim()&&['묵상기도','좋은소식','축도'].includes(label));}
/** 매주 꼭 채워야 하는 예배 순서 내용 칸 (찬송·성경봉독·말씀 선포·결단 & 찬송). */
export function requiredOrderCell(row){return ['찬송','성경봉독','말씀선포','결단&찬송'].includes(rowIdentity(row[0]));}
const defaultRowNames={order:defaultOrderRows.map(r=>rowIdentity(r[0])),staff:defaultStaffRows.map(r=>rowIdentity(r[0])),volunteer:['교회청소','기도인도'],offering:defaultOfferingRows.map(r=>rowIdentity(r[0]))};
/** Rows that come with every new bulletin cannot be deleted (only disabled); rows the editor added can. */
export function defaultRow(kind,row){return (defaultRowNames[kind]??[]).includes(rowIdentity(row?.[0]))&&!!rowIdentity(row?.[0]);}
/** @param {import('./bulletins').BlockContent} content */
export function removeContentRow(content,index){const keep=(content.rows??[]).map((_,i)=>i).filter(i=>i!==index);return {...content,rows:keep.map(i=>content.rows[i]),disabledRows:keep.flatMap((old,i)=>content.disabledRows?.includes(old)?[i]:[]),...(content.fullRows?{fullRows:keep.flatMap((old,i)=>content.fullRows.includes(old)?[i]:[])}:{})};}

/* ── 월별 자동 규칙 ── */
/** 첫째·셋째 주일 오후 찬양예배 공지(‘좋은 소식 · 예배’ 칸). 본문·제목은 매번 채운다. */
export const afternoonNotice='1시 오후 찬양예배\n본문 : \n제목 : ';
const afternoonHead=/^1시 오후 찬양예배[^\n]*(?:\n본문\s*:[^\n]*)?(?:\n제목\s*:[^\n]*)?\n*/;
/** 그 달의 첫째·셋째 주일이면 true(다섯째 주일은 아님). */
export function afternoonWorship(value){const d=date(value),day=d.getUTCDate();return d.getUTCDay()===0&&(day<=7||day>=15&&day<=21);}
/** 그 주 ‘좋은 소식 · 예배’ 본문: 오후예배 주에는 공지를 맨 위에 두고, 아닌 주에는 지난 공지를 뺀다. 편집자가 쓴 다른 내용은 둔다. */
export function worshipNewsBody(body,value){const rest=String(body??'').replace(afternoonHead,'').trim();return afternoonWorship(value)?(rest?`${afternoonNotice}\n\n${rest}`:afternoonNotice):rest;}
/** 매월 첫 주일에만 전월 헌금 내역을 싣는다: 그 주의 집계 월(YYYY-MM)과 표를 켤지. */
export function offeringFor(value){const d=date(value);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);return {month:d.toISOString().slice(0,7),disabled:Number(String(value).slice(8))>7};}
/** 지난 주 주보를 복사한 항목에 그 주 날짜의 월별 규칙을 적용한다(헌금 내역·오후예배 공지).
 * @template {{title:string,kind?:string,body:string,content?:any}} T
 * @param {T[]} items @param {string} value @returns {T[]} */
export function applyMonthlyRules(items,value){return items.map(item=>{
 if(item.kind==='offering'){const {month,disabled}=offeringFor(value);return {...item,content:{...item.content,month,disabled,rows:(item.content?.rows??[]).map(row=>[row[0],''])}};}
 if(/^좋은 소식\s*[·ㆍ･]\s*예배$/.test(item.title.trim())&&(item.kind??'text')==='text')return {...item,body:worshipNewsBody(item.body,value)};
 return item;
});}
