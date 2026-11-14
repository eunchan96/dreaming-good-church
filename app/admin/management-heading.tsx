import ui from './management.module.css';
export default function ManagementHeading({eyebrow,title,description,id}:{eyebrow:string;title:string;description:string;id:string}){
 return <header className={ui.intro}><span>{eyebrow}</span><h1 id={id}>{title}</h1><p>{description}</p></header>;
}
