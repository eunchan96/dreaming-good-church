export type TimeKey='sunday'|'afternoon'|'friday'|'dawn'|'students'|'monthly';
export type WorshipTimeSetting={key:TimeKey;time:string;recurrence:string};
export type OfferingAccountSetting={key:'general'|'building';bank:string;number:string;holder:string};
export type LocationSetting={latitude:number;longitude:number;zoom:number;landmark:string;transit:string};
export type ChurchPageSettings={worship_times:WorshipTimeSetting[];offering_accounts:OfferingAccountSetting[];location:LocationSetting};
export type SettingKey=keyof ChurchPageSettings;
export const settingLabels:Record<SettingKey,string>={worship_times:'예배시간',offering_accounts:'온라인 헌금계좌',location:'지도·방문안내'};
export const timeLabels:Record<TimeKey,string>={sunday:'주일예배',afternoon:'주일오후예배',friday:'금요예배',dawn:'새벽예배',students:'학생 예배',monthly:'월삭새벽예배'};
export const defaultPageSettings:ChurchPageSettings={
 worship_times:[{key:'sunday',time:'10:45',recurrence:'주일'},{key:'afternoon',time:'13:00',recurrence:'첫째·셋째 주일'},{key:'friday',time:'20:45',recurrence:'금요일'},{key:'dawn',time:'05:25',recurrence:'새벽'},{key:'students',time:'09:30',recurrence:'주일'},{key:'monthly',time:'05:25',recurrence:'매월 첫날'}],
 offering_accounts:[{key:'general',bank:'농협',number:'301-0223-0182-71',holder:'좋은교회'},{key:'building',bank:'농협',number:'301-0220-0484-81',holder:'좋은교회'}],
 location:{latitude:37.6223746,longitude:126.8354385,zoom:16,landmark:'샘터마을2단지아파트 앞 · 행신초등학교에서 도보 2분',transit:'샘터마을2단지아파트 앞에 있습니다.\n행신초등학교에서 도보로 약 2분 거리입니다.'}
};
const text=(v:unknown,min:number,max:number,multiline=false)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&(multiline||!/[\r\n]/.test(v));
const object=(v:unknown,n:number):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===n;
export function validPageSetting<K extends SettingKey>(key:K,value:unknown):value is ChurchPageSettings[K]{
 if(key==='worship_times')return Array.isArray(value)&&value.length===6&&new Set(value.map(v=>v?.key)).size===6&&value.every(v=>object(v,3)&&typeof v.key==='string'&&Object.hasOwn(timeLabels,v.key)&&typeof v.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)&&text(v.recurrence,1,60));
 if(key==='offering_accounts')return Array.isArray(value)&&value.length===2&&new Set(value.map(v=>v?.key)).size===2&&value.every(v=>object(v,4)&&typeof v.key==='string'&&['general','building'].includes(v.key)&&text(v.bank,1,30)&&text(v.holder,1,60)&&typeof v.number==='string'&&/^[0-9][0-9-]{4,38}[0-9]$/.test(v.number)&&!v.number.includes('--'));
 return object(value,5)&&typeof value.latitude==='number'&&Number.isFinite(value.latitude)&&value.latitude>=-90&&value.latitude<=90&&typeof value.longitude==='number'&&Number.isFinite(value.longitude)&&value.longitude>=-180&&value.longitude<=180&&Number.isInteger(value.zoom)&&Number(value.zoom)>=10&&Number(value.zoom)<=20&&text(value.landmark,0,200)&&text(value.transit,0,1000,true);
}
export function formatWorshipTime(row:WorshipTimeSetting){const [hour,minute]=row.time.split(':').map(Number);if(row.key==='dawn'&&row.recurrence==='새벽')return `새벽 ${hour}:${String(minute).padStart(2,'0')}`;const period=hour<12?'오전':hour<18?'오후':'저녁';const display=hour%12||12;const padded=['students','monthly'].includes(row.key)?String(display).padStart(2,'0'):String(display);return `${row.recurrence} ${period} ${padded}:${String(minute).padStart(2,'0')}`;}
