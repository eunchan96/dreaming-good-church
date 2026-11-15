export const standingFooter='↑ 표시는 일어서서, 몸이 불편한 분은 앉아 계셔도 됩니다.';
export const defaultOrderRows=[
 ['↑ 하나님은 영이시니 예배하는 자가 영과 진리로 예배할지로다 아멘 (일어섬)','',''],
 ['↑ 찬송','','다 같이'],['↑ 묵상기도','','다 같이'],['↑ 신앙고백','사도신경','다 같이'],['찬송','','다 같이'],['기도 인도','',''],['특송','',''],['좋은 소식','','인도자'],['성경봉독','','다 같이'],['말씀 선포','','최선주 목사'],['봉헌 & 기도','헌금은 헌금함에 하시면 됩니다','인도자'],['↑ 결단 & 찬송','','다 같이'],['축도','','최선주 목사']
];
export const defaultStaffRows=[['담임 목사','최선주',''],['협동 전도사','유연학',''],['예배 찬양','방종혁 · 방은찬 · 최성민 · 유다은',''],['예배 반주','강준호 · 조용주 · 김소희 · 표재현',''],['영상･유튜브','윤채성 ･ 최민지',''],['교회 청소','문민 집사 · 천미애 집사',''],['토브 지휘자','강준호',''],['성경 봉독','조근혜','']];
export const defaultAccountBody='온라인 헌금계좌: 농협 301-0223-0182-71 좋은교회\n온라인 건축헌금: 농협 301-0220-0484-91 좋은교회';
export const defaultOfferingRows=['온라인 / 주일헌금','온라인 / 십일조','온라인 / 감사헌금','온라인 / 구제헌금','온라인 / 건축헌금','주일헌금','십일조','감사헌금','선교헌금','건축헌금','구제헌금','일천번제','월삭감사'].map(label=>[label,'']);
export const rowIdentity=value=>String(value??'').replace(/[↑\s·]/g,'');
const date=value=>new Date(value+'T12:00:00Z');
export function offsetDate(value,days){const d=date(value);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function shortDate(value){const d=date(value);return `${d.getUTCMonth()+1}/${d.getUTCDate()}`;}
export function volunteerDefaults(value){const d=date(value),saturday=offsetDate(value,(6-d.getUTCDay()+7)%7),sunday=offsetDate(value,(7-d.getUTCDay())||7);return [['교회 청소','',shortDate(saturday)],['기도 인도','',shortDate(sunday)]];}
export function shiftPrayerRows(rows,value,previousDate){const weeks=previousDate?Math.max(0,Math.round((date(value)-date(previousDate))/604800000)):1;return Array.from({length:5},(_,i)=>[shortDate(offsetDate(value,i*7)),rows?.[i+weeks]?.[1]??'',rows?.[i+weeks]?.[2]??'']);}
export function fixedOrderCell(row,column){const label=rowIdentity(row[0]);if(column===0)return true;if(column===2)return /^(다같이|인도자|최선주목사)$/.test(rowIdentity(row[2]));return label==='신앙고백'||label==='봉헌&기도'||(!row[1]?.trim()&&['묵상기도','기도인도','좋은소식','축도'].includes(label));}
/** @param {import('./bulletins').BlockContent} content */
export function removeContentRow(content,index){const keep=(content.rows??[]).map((_,i)=>i).filter(i=>i!==index);return {...content,rows:keep.map(i=>content.rows[i]),disabledRows:keep.flatMap((old,i)=>content.disabledRows?.includes(old)?[i]:[]),...(content.fullRows?{fullRows:keep.flatMap((old,i)=>content.fullRows.includes(old)?[i]:[])}:{})};}
