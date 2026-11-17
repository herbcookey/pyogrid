# 배포 방법

`v*` 태그를 push하면 [.github/workflows/release.yml](../.github/workflows/release.yml)이 아래 순서로 돈다.

1. **확인**: 태그가 `package.json`의 버전과 같은지(`v0.10.0` ↔ `0.10.0`), `src/index.js`·README의 버전이 맞는지(`tools/sync-version.mjs --check`), CHANGELOG.md에 그 버전 절(`## 0.10.0`)이 있는지 본다. 하나라도 틀리면 여기서 멈춘다.
2. **전체 테스트**: [test.yml](../.github/workflows/test.yml)을 그대로 부른다 (lint, 타입 검사, 커버리지 포함 단위 테스트, 빌드, 타입 테스트, Chrome·Firefox·WebKit e2e).
3. **npm 배포**: 빌드한 뒤 `npm stage publish`로 올린다. npm의 Staged Packages에 올라가고, npmjs.com에서 2FA로 Approve해야 공개된다. 버전에 `-`가 있으면(`1.0.0-beta.1`) dist-tag `next`로 올린다.
4. **GitHub Release**: CHANGELOG의 그 버전 절을 본문으로 Release를 만든다. 버전에 `-`가 있으면 pre-release로 표시한다.

npm 토큰은 쓰지 않는다. npm의 trusted publishing(OIDC)으로 이 워크플로만 배포할 수 있게 한다.

## 처음 한 번 설정할 것

순서대로 한다. 1번의 npm 설정은 만든 뒤 2일 안에 첫 배포가 성공해야 유지되므로, 첫 태그를 올리기 직전에 한다.

1. **GitHub 환경 만들기**: 저장소 Settings → Environments → New environment, 이름 `npm`.
   - Deployment branches and tags에서 "Selected branches and tags"를 고르고 태그 규칙 `v*`를 넣는다 (다른 브랜치에서 배포 작업이 돌지 않게).
   - 배포 전에 한 번 더 누르고 싶으면 Required reviewers에 자신을 넣는다 (npm Approve가 이미 있으므로 없어도 된다).
2. **태그 보호 (권장)**: Settings → Rules → Rulesets → New ruleset → New tag ruleset. Target에 `v*`, Rules에 "Restrict creations", "Restrict updates", "Restrict deletions"를 켜고 Bypass list에 자신을 넣는다. 다른 사람이 `v*` 태그로 배포를 일으키지 못한다.
3. **npm trusted publisher 추가**: npmjs.com → pyogrid → Settings → Trusted publishing → GitHub Actions.
   - Organization or user: `herbcookey`
   - Repository: `pyogrid`
   - Workflow filename: `release.yml` (경로 없이 파일 이름만)
   - Environment name: `npm`
   - Allowed actions: `npm stage publish`는 늘 허용된다. 바로 공개(`npm publish`)는 허용하지 않는다 (release.yml의 `PUBLISH_COMMAND`를 `publish`로 바꿀 때만 허용).
4. **첫 배포**: 아래 "배포할 때"대로 한다. 확인·테스트·배포 작업이 모두 초록이면, npmjs.com의 Staged Packages에서 그 버전을 열어 내용을 보고 Approve한다.
5. **토큰 막기 (첫 배포가 성공한 뒤)**: npmjs.com → pyogrid → Settings → Publishing access에서 "Require two-factor authentication and disallow tokens"를 고르고 저장한다. 쓰지 않는 npm 토큰(Access Tokens)은 지운다. 이 설정은 trusted publishing에는 영향이 없다.

## 배포할 때

```bash
# 1. CHANGELOG.md의 "## Unreleased"를 "## 0.10.0"으로 바꿔 커밋한다
# 2. 버전 올리기: package.json, src/index.js, README의 버전을 고치고 커밋·태그한다
npm version minor          # 또는 patch, major
# 3. 커밋과 태그를 올린다. 태그가 올라가면 Release 워크플로가 돈다
git push origin main --follow-tags
```

- `internal-history`, `main-before-squash` 같은 다른 브랜치는 올리지 않는다 (`git push --all` 쓰지 않음).
- 실패하면: 확인 단계에서 멈췄으면 고친 뒤 태그를 지우고(`git push origin :refs/tags/v0.10.0`, `git tag -d v0.10.0`) 다시 만든다. 테스트에서 멈췄으면 원인을 보고 같은 방법으로 다시 올린다. npm에 이미 올라간 버전 번호는 다시 쓸 수 없다 (Approve 전에 Reject한 staged 버전은 괜찮다).
- 로컬에서 `npm publish`도 여전히 된다 (`prepublishOnly`가 타입 검사, 단위 테스트, Chrome e2e를 돌린다). 둘을 섞으면 같은 버전을 두 번 올리게 되므로 한 가지만 쓴다.
