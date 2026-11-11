import {it,expect} from 'vitest';
import {makePart,makeConnection} from '../src/model/library';
import {snapGear,resizeFromEdge} from '../src/model/editing';
import {localToWorld,radiusOf} from '../src/model/types';
import {useEditor} from '../src/store/editor';
import {EXAMPLES} from '../src/model/examples';
import {MechanicaEngine} from '../src/physics/engine';
it('snaps to pitch distance, including differently sized gears, and respects module compatibility',()=>{
 const a=makePart('gear',0,0,{teeth:48}),b=makePart('gear',1.9,0);
 const result=snapGear(b,[a],.2)!;expect(result.point.x).toBeCloseTo(radiusOf(a)+radiusOf(b));
 expect(snapGear({...b,module:.06},[a],.2)).toBeNull();expect(snapGear({...b,x:5},[a],.2)).toBeNull();
});
it('resizes a rotated frame while holding the opposite end fixed and clamps minimum size',()=>{
 const p=makePart('frame',3,2,{angle:Math.PI/3,width:3}),fixed=localToWorld(p,{x:-1.5,y:0});
 const next=resizeFromEdge(p,1,localToWorld(p,{x:3.5,y:0}));
 expect(next.width).toBeCloseTo(5);expect(localToWorld(next,{x:-next.width/2,y:0}).x).toBeCloseTo(fixed.x);expect(localToWorld(next,{x:-next.width/2,y:0}).y).toBeCloseTo(fixed.y);
 expect(resizeFromEdge(p,1,localToWorld(p,{x:-5,y:0})).width).toBe(.08);
});
it('resizing preserves connected anchor world positions and is one undo operation',()=>{
 const p=EXAMPLES[0].build(),frame=makePart('frame'),body=makePart('box',0,2),c=makeConnection('spring',frame.id,body.id,{portA:{x:1,y:0}});p.parts=[frame,body];p.connections=[c];useEditor.getState().load(p);
 const next=resizeFromEdge(frame,1,{x:4,y:0});useEditor.getState().resizePart(next);
 const s=useEditor.getState(),newFrame=s.project.parts[0],port=s.project.connections[0].portA;
 expect(localToWorld(newFrame,port)).toEqual(localToWorld(frame,c.portA));expect(s.history).toHaveLength(1);s.undo();expect(useEditor.getState().project.parts[0]).toEqual(frame);
});
it('fits modules and geometry atomically, repairs existing links and produces a runnable mechanism',()=>{
 const p=EXAMPLES[0].build();p.parts=p.parts.filter(p=>p.kind==='gear').slice(0,2);p.connections=[];p.parts[1].x+=.3;p.parts[1].module=.06;useEditor.getState().load(p);
 useEditor.getState().fitGears(p.parts[0].id,p.parts[1].id);const s=useEditor.getState();expect(s.history).toHaveLength(1);expect(s.project.connections).toHaveLength(1);expect(()=>new MechanicaEngine(s.project)).not.toThrow();s.undo();expect(useEditor.getState().project).toEqual(p);
});
