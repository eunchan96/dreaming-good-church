import type {WorshipType} from '@/lib/site-content';
import WorshipGallery from './worship-gallery';
export default function WorshipVideo({type='sunday',compact=false,label}:{type?:WorshipType;compact?:boolean;label?:string}){return <WorshipGallery key={type} type={type} compact={compact} label={label}/>;}
