import {describe,it,expect} from 'vitest';
import {validateProject} from '@ai-composer/music-core';
describe('MCP snapshot contract',()=>{it('accepts valid projects and rejects malformed ones',()=>{expect(validateProject({projectId:'test',revision:0,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[]}]})).toBe(true);expect(validateProject({projectId:'test',revision:0,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[{pitch:500}]}]})).toBe(false);});});
