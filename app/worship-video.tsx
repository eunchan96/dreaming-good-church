import type {WorshipType} from '@/lib/site-content';
import WorshipGallery from './worship-gallery';
export default function WorshipVideo({type='sunday',compact=false}:{type?:WorshipType;compact?:boolean}){return <WorshipGallery key={type} type={type} compact={compact}/>;}
