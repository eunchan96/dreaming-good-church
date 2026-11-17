# 꿈꾸는좋은교회

[운영 홈페이지](https://dreaming-good-church.vercel.app) · [운영 안내: 주보·게시 취소·백업·장애 대응](docs/operations-handbook.md)

주보·공지/일정·교회 안내와 관리자 편집 기능을 개발 중입니다.
[현재 구현 범위와 로컬 실행·검증 방법](docs/bulletin-drafts.md)을 참고하세요.

개인정보 없는 3주 샘플로 확인하려면 [로컬 샘플 실행 안내](docs/local-samples.md)를 참고하세요.
`npm run dev:local`은 3001번의 로컬 DB에 연결하며, `npm run dev`가 사용하는 운영 DB와 분리됩니다.

현재 확인할 화면은 [교회 홈페이지](http://localhost:3000)와 [관리자 주보 편집](http://localhost:3000/admin/bulletins)입니다.
`npm run dev`는 `.env.local`의 실제 Supabase 프로젝트에 연결합니다.
새 운영자는 생성된 `.local/admin-invite-UUID.html`에서 계정 링크를 열어 비밀번호를 정합니다.
이미 설정한 계정은 기존 비밀번호로 로그인합니다. 자세한 [배포 계정·초대/재설정 안내](docs/deployed-accounts.md)를 참고하세요.

## Getting Started

아래는 Next.js 기본 실행 명령 참고입니다.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
