import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPageSettings,validPageSetting,formatWorshipTime} from '../lib/church-page-settings.ts';

test('approved page defaults validate and retain familiar time formats',()=>{
 for(const [key,value] of Object.entries(defaultPageSettings))assert.equal(validPageSetting(key,value),true);
 assert.equal(formatWorshipTime(defaultPageSettings.worship_times[1]),'첫째·셋째 주일 오후 1:00');
 assert.equal(formatWorshipTime(defaultPageSettings.worship_times[3]),'새벽 5:25');
 assert.equal(formatWorshipTime(defaultPageSettings.worship_times[4]),'주일 오전 09:30');
 assert.equal(formatWorshipTime(defaultPageSettings.worship_times[5]),'매월 첫날 오전 05:25');
});
test('reject malformed times, repeated types and unsafe account or location payloads',()=>{
 const times=structuredClone(defaultPageSettings.worship_times);times[0].time='24:00';assert.equal(validPageSetting('worship_times',times),false);
 times[0].time='10:45';times[0].key='afternoon';assert.equal(validPageSetting('worship_times',times),false);
 const accounts=structuredClone(defaultPageSettings.offering_accounts);accounts[0].number='301--123';assert.equal(validPageSetting('offering_accounts',accounts),false);
 accounts[0].number='301-123';accounts[0].holder='  ';assert.equal(validPageSetting('offering_accounts',accounts),false);
 for(const change of [{latitude:NaN},{longitude:181},{zoom:16.5},{landmark:'a\nb'},{zoom:'16'},{transit:'x'.repeat(1001)}])assert.equal(validPageSetting('location',{...defaultPageSettings.location,...change}),false);
 assert.equal(validPageSetting('location',{...defaultPageSettings.location,transit:'버스\n도보 안내'}),true);
 for(const key of Object.keys(defaultPageSettings))for(const value of [null,{},[],true,''])assert.equal(validPageSetting(key,value),false);
});
