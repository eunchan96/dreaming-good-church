import Link from 'next/link';
import PublicShell from '../public-shell';
import SiteIcon from '../site-icon';
import styles from '../public-site.module.css';
import css from './policy.module.css';

type Section = { t: string; p: string[] };
const EMAIL = 'dreaming.towb.church@gmail.com';
const EFFECTIVE = '2026년 11월 23일';
const sections: Record<'privacy' | 'photo', Section[]> = {
  "privacy": [
    {
      "t": "홈페이지에서 이용하는 정보",
      "p": [
        "공개 예배 영상과 교회 소식은 방문자 회원가입 없이 볼 수 있으며, 방문자의 이름·연락처 등을 직접 받지 않습니다. 관리자 로그인에는 이메일과 인증 정보가 사용됩니다. 게시된 주보·교회 안내는 인터넷에서 누구나 볼 수 있습니다."
      ]
    },
    {
      "t": "외부 서비스",
      "p": [
        "홈페이지 제공과 관리자 인증에는 Vercel·Supabase를 이용합니다. 서버 기능과 데이터베이스는 서울 지역에서 운영합니다. YouTube 영상·Google 지도는 외부 서비스에서 불러오며, 연결할 때 해당 서비스로 접속 정보가 전달될 수 있습니다. 접속 기록·쿠키 등은 각 서비스(Vercel·Supabase·Google)의 개인정보 처리방침에 따라 해외 법인에서 처리될 수 있습니다."
      ]
    },
    {
      "t": "보유 및 삭제",
      "p": [
        "관리자 계정(이메일) 정보는 관리자 권한을 해제하거나 초대를 취소하면 바로 삭제합니다.",
        "운영 백업은 암호화해 PC와 Google Drive에 보관하며, 최근 12개월 분만 보관하고 그보다 오래된 백업은 삭제합니다.",
        "공개 주보·교회 안내에는 이름·연락처 등 개인정보를 싣지 않는 것을 원칙으로 합니다."
      ]
    },
    {
      "t": "열람·정정·삭제 요청",
      "p": [
        "본인의 개인정보에 대한 열람·정정·삭제를 요청하실 수 있습니다. 아래 이메일로 요청하시는 분과 대상(해당 페이지 주소)을 알려 주시면, 접수 후 10일 이내에 처리하고 결과를 알려 드립니다."
      ]
    }
  ],
  "photo": [
    {
      "t": "사진의 공개 범위",
      "p": [
        "사진을 웹에 공개하면 교회 밖에서도 열람·저장·공유할 수 있습니다. 이미 외부에서 저장하거나 공유한 사본은 홈페이지에서 삭제해도 함께 회수되지 않을 수 있습니다."
      ]
    },
    {
      "t": "게시 기준",
      "p": [
        "사람이 식별되는 사진은 게시 전에 사진에 나온 분께 알리고 동의를 받습니다. 아동·청소년이 나온 사진은 보호자(법정대리인)의 동의를 받습니다. 여러 사람이 함께 나온 사진은 게시 전에 안내하며, 원치 않는 분은 알려 주시면 게시에서 제외합니다.",
        "사진에는 이름·연락처 등 신상 정보를 함께 싣지 않습니다. 주보의 ‘웹 공개’ 설정은 게시 범위를 정하는 기능입니다. 사진에 나온 사람의 촬영·공개 동의를 대신하지 않습니다."
      ]
    },
    {
      "t": "게시된 사진의 삭제·가림 요청",
      "p": [
        "게시된 사진을 내리거나 가리고 싶으시면 아래 이메일로 해당 페이지 주소와 사진의 위치를 알려 주세요. 접수 후 10일 이내에 처리하고 결과를 알려 드립니다."
      ]
    }
  ]
};

export default function PolicyPage({ type }: { type: 'privacy' | 'photo' }) {
  const privacy = type === 'privacy';
  const list = sections[type];
  const last = list.length + 1;
  return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}>
    <header className={styles.pageHeading}><p className={styles.eyebrow}>{privacy ? 'PRIVACY' : 'PHOTO POLICY'}</p><h1>{privacy ? '개인정보처리방침' : '사진 게시정책'}</h1><p>홈페이지 이용과 소중한 기록을 위한 안내입니다.</p></header>
    <div className={css.layout}>
      <article className={css.article}>
        <p className={css.notice}><strong>시행일 {EFFECTIVE}</strong>꿈꾸는좋은교회 홈페이지에 적용됩니다. 내용이 바뀌면 이 페이지에 시행일과 함께 안내합니다.</p>
        {list.map((section, i) => <section key={section.t} id={`policy-${i + 1}`} className={css.section}>
          <h2><span>{String(i + 1).padStart(2, '0')}</span>{section.t}</h2>
          {section.p.map((text, n) => <p key={n}>{text}</p>)}
        </section>)}
        <section id={`policy-${last}`} className={css.section}>
          <h2><span>{String(last).padStart(2, '0')}</span>{privacy ? '개인정보 보호책임자' : '문의'}</h2>
          <dl className={css.officer}>
            {privacy ? <div><dt>책임자</dt><dd>방은찬</dd></div> : null}
            <div><dt>연락처</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div>
          </dl>
        </section>
        <Link href="/church/directions" className={css.contact}>교회 연락처·오시는 길<SiteIcon size={16} /></Link>
      </article>
    </div>
  </main></PublicShell>;
}
