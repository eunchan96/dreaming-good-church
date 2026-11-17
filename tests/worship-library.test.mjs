import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeId} from '../lib/worship-library.ts';
test('YouTube input accepts video links and rejects other hosts and unsafe identifiers',()=>{
 const id='OSfMkv-YWJQ';
 for(const link of [id,`https://youtu.be/${id}?t=10`,`https://www.youtube.com/watch?v=${id}&list=abc`,`https://www.youtube.com/live/${id}`,`https://www.youtube.com/shorts/${id}`,`https://www.youtube-nocookie.com/embed/${id}`])assert.equal(youtubeId(link),id);
 for(const link of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v='+id,'https://user@youtube.com/watch?v='+id,'https://www.youtube.com/playlist?list=abc','https://example.com/'+id,'<script>','https://youtube.com:8080/watch?v='+id])assert.equal(youtubeId(link),null);
});
