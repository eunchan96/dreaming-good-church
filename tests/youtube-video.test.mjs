import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSundayVideo,VERIFIED_SUNDAY_VIDEO} from '../lib/youtube-video.mjs';
const fixture=(videos,channel='UCSkvK9jOZFIT84hiS0B5Rzg')=>'var ytInitialData = '+JSON.stringify({metadata:{channelMetadataRenderer:{externalId:channel}},contents:videos.map(([id,title])=>({lockupViewModel:{contentId:id,metadata:{lockupMetadataViewModel:{title:{content:title}}}}}))})+';</script>';
test('latest Sunday selection skips praise and other services in newest-first order',()=>{
 const result=parseSundayVideo(fixture([['11111111111','주일예배 찬양'],['22222222222','금요설교 (요한복음 1:1)'],['33333333333','네가 나를 사랑하느냐 (요한복음 21:1-17)'],['44444444444','이전 말씀 (시편 1:1)']]));
 assert.equal(result.id,'33333333333');assert.equal(result.source,'channel');
});
test('unrecognized or hostile metadata fails closed for the verified fallback',()=>{
 for(const html of ['invalid','var ytInitialData = broken;</script>',fixture([['12345678901','주일예배']],'other'),fixture([['invalid-id<script>','주일예배']]),fixture([['12345678901','주일오후예배']]),'x'.repeat(3000001)])assert.equal(parseSundayVideo(html),null);
 assert.match(VERIFIED_SUNDAY_VIDEO.id,/^[\w-]{11}$/);assert.equal(VERIFIED_SUNDAY_VIDEO.source,'verified');
});
