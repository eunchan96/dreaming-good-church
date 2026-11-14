import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultHomeContent,validHomeContent} from '../lib/home-content.ts';
test('home content bounds text, modes, local image IDs and focus while preview accepts unfinished text',()=>{
 assert.equal(validHomeContent(defaultHomeContent),true);
 for(const change of [{title_line1:'가'.repeat(13)},{title_line1:'줄\n바꿈'},{title_line2:''},{image_mode:'remote',image_asset_id:'https://evil.test/image'},{image_mode:'photo',image_asset_id:null},{focus_x:101},{focus_y:1.5},{image_ratio:'arbitrary'}])assert.equal(validHomeContent({...defaultHomeContent,...change}),false);
 assert.equal(validHomeContent({...defaultHomeContent,title_line1:''},true),true);
 const photo={...defaultHomeContent,image_mode:'photo',image_asset_id:'e7a1e911-1111-4111-8111-111111111111',image_alt:'예배하는 교회'};assert.equal(validHomeContent(photo),true);
 assert.equal(validHomeContent({...photo,image_alt:''}),false);
});
