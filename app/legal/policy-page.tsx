import Link from 'next/link';
import PublicShell from '../public-shell';
import SiteIcon from '../site-icon';
import styles from '../public-site.module.css';
import css from './policy.module.css';

type Section = { t: string; p: string[] };
// 문구는 담당자·처리 기준 확인 전의 안내 초안이다. 화면 구성만 바꾸고 내용은 그대로 둔다.
const sections: Record<'privacy' | 'photo', Section[]> = {
  "privacy": [
    {
      "t": "홈페이지에서 이용하는 정보",
      "p": [
        "공개 예배 영상과 교회 소식은 방문자 회원가입 없이 볼 수 있습니다. 관리자 로그인에는 이메일과 인증 정보가 사용됩니다. 게시된 주보·교회 안내는 인터넷에서 누구나 볼 수 있습니다."
      ]
    },
    {
      "t": "외부 서비스와 기기 저장",
      "p": [
        "홈페이지 제공과 관리자 인증에는 Vercel·Supabase를 이용합니다. YouTube 영상·Google 지도는 외부 서비스에서 불러오며, 연결할 때 해당 서비스로 접속 정보가 전달될 수 있습니다. 접속 기록·쿠키 등 각 서비스의 처리 범위는 확인 중입니다.",
        "앱 추가 화면에서 직접 저장한 공개 주보·교회 안내는 기기에 24시간 보관됩니다. 같은 화면에서 저장 내용을 지울 수 있습니다. 운영 백업은 암호화해 PC와 Google Drive에 보관하며, 세부 보존·삭제 및 외부 서비스 처리 사항은 정식 방침에 포함할 예정입니다."
      ]
    },
    {
      "t": "확인하고 있는 사항",
      "p": [
        "개인정보 보호 담당자와 요청 창구, 항목별 보유·삭제 기간, 서비스 위탁 및 국외 처리 내역을 확인하고 있습니다. 확인 전의 내용을 확정된 처리방침으로 안내하지 않습니다."
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
      "t": "검토하고 있는 게시 기준",
      "p": [
        "사진의 이용 권한과 촬영·게시 목적, 식별 가능한 사람의 공개 의사를 확인하는 절차를 마련하고 있습니다. 아동·청소년 사진의 보호자 확인, 이름·연락처 등 신상 노출 방지, 게시 제외와 가림·삭제 요청 절차도 함께 정리합니다.",
        "주보의 ‘웹 공개’ 설정은 게시 범위를 정하는 기능입니다. 사진에 나온 사람의 촬영·공개 동의를 대신하지 않습니다."
      ]
    },
    {
      "t": "게시된 사진에 관한 문의",
      "p": [
        "문의할 때 해당 페이지 주소와 사진의 위치를 알려주시면 확인에 도움이 됩니다. 접수 담당자와 공식 요청 창구는 정책 확인 후 안내하겠습니다."
      ]
    }
  ]
};

export default function PolicyPage({ type }: { type: 'privacy' | 'photo' }) {
  const privacy = type === 'privacy';
  const list = sections[type];
  return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}>
    <header className={styles.pageHeading}><p className={styles.eyebrow}>{privacy ? 'PRIVACY' : 'PHOTO POLICY'}</p><h1>{privacy ? '개인정보처리방침' : '사진 게시정책'}</h1><p>홈페이지 이용과 소중한 기록을 위한 안내입니다.</p></header>
    <div className={css.layout}>
      <nav className={css.index} aria-label="이 페이지의 항목"><h2>목차</h2><ol>{list.map((section, i) => <li key={section.t}><a href={`#policy-${i + 1}`}>{section.t}</a></li>)}</ol></nav>
      <article className={css.article}>
        <p className={css.notice}><strong>정책 확인 중</strong>아래는 현재 홈페이지의 이용 안내와 정책 검토 항목입니다. 담당자·처리 기준을 확인한 뒤 정식 정책과 시행일을 안내하겠습니다.</p>
        {list.map((section, i) => <section key={section.t} id={`policy-${i + 1}`} className={css.section}>
          <h2><span>{String(i + 1).padStart(2, '0')}</span>{section.t}</h2>
          {section.p.map((text, n) => <p key={n}>{text}</p>)}
        </section>)}
        <Link href="/church/directions" className={css.contact}>교회 연락처·오시는 길<SiteIcon size={16} /></Link>
      </article>
    </div>
  </main></PublicShell>;
}
