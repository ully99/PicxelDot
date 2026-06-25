import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { Tool } from "./types";

export type Language = "en" | "ko";

const STORAGE_KEY = "dot-maker-language";

export const copy = {
  en: {
    language: "Language",
    english: "EN",
    korean: "KO",
    navGuide: "Guide",
    navAbout: "About",
    navPrivacy: "Privacy",
    navTerms: "Terms",
    aboutContact: "About / Contact",
    guideFaq: "Guide & FAQ",
    privacyPolicy: "Privacy Policy",
    termsService: "Terms of Service",
    create: "Create",
    createPixelArt: "Create Pixel Art",
    readGuide: "Read Guide",
    openEditor: "Open Editor",
    badge: "Free browser pixel editor",
    headline: "Pixel art, sprites, and tiny animations in your browser.",
    intro:
      "Draw icons, game sprites, frame animations, and palette-limited artwork without installing anything. Start with a clean 32 x 32 canvas and export when your sprite is ready.",
    defaultCanvas: "default canvas",
    frameCels: "frame cels",
    exports: "exports",
    examplesTitle: "What you can make",
    examplesText: "Small examples of sprites, tiles, icons, and animation-ready frames.",
    featurePaletteTitle: "Palette shading",
    featurePaletteText: "Use Lighten and Darken to nudge pixels one step at a time while keeping a hand-made pixel look.",
    featureAnimationTitle: "Frame animation",
    featureAnimationText: "Build animation matrices, preview playback, and export still frames or animated output.",
    featureLocalTitle: "Local workflow",
    featureLocalText: "Work in the browser and save project files locally so your artwork stays under your control.",
    builtTitle: "Built for quick sprite work",
    builtText:
      "MAKE PIXEL DOT keeps the editor focused: palette on the left, tools on the right, canvas in the center, and timeline underneath. The homepage explains the tool, while the editor stays clear for drawing.",
    useCasesTitle: "Use cases for pixel art and sprite work",
    useCasesText:
      "The editor is useful for small creative assets that need clean edges, limited colors, and predictable export sizes.",
    useCaseSpritesTitle: "Game sprites",
    useCaseSpritesText: "Sketch idle frames, walk cycles, props, pickups, effects, and UI objects for 2D games.",
    useCaseIconsTitle: "Icons and tiles",
    useCaseIconsText: "Create favicons, app icons, interface symbols, tiles, badges, and decorative pixel assets.",
    useCaseLearningTitle: "Learning pixel art",
    useCaseLearningText: "Practice silhouettes, palette control, shading, and frame timing on a small focused canvas.",
    workflowTitle: "A practical workflow from idea to export",
    workflowText:
      "Start with a simple silhouette, refine the palette, separate details into layers, preview animation frames, then export the format that fits your project.",
    workflowStepOne: "Block out the shape with the Pencil tool and a small palette.",
    workflowStepTwo: "Use layers for outlines, color, highlights, shadows, and effects.",
    workflowStepThree: "Add frames or matrices when the artwork needs animation.",
    workflowStepFour: "Save a .dotproj file for future edits and export PNG, GIF, or spritesheets for use elsewhere.",
    localFirstTitle: "Browser-based and local-first",
    localFirstText:
      "MAKE PIXEL DOT is designed for quick browser work. Your drawing process stays in the editor, and project files can be saved locally when you want to keep editing later.",
    selectionWorkflow: "Selection workflow",
    selectionWorkflowText: "Copy, cut, paste, flip, delete, and move selected pixels with Shift or the mobile Move toggle.",
    exportOptions: "Export options",
    exportOptionsText: "Save PNGs, GIFs, spritesheets, and .dotproj project files from the editor.",
    lightenTool: "Lighten tool",
    lightenToolText: "Add highlights in small controlled steps.",
    darkenTool: "Darken tool",
    darkenToolText: "Push shadow pixels darker without jumping straight to black.",
    footer: "2026 MAKE PIXEL DOT. Browser-based pixel art editor.",
    palette: "Palette",
    tools: "Tools",
    matrix: "Matrix",
    play: "Play",
    saveDrawing: "Save Drawing",
    stopPreview: "Stop Preview",
    linkPrevious: "Link Previous",
    unlinkCel: "Unlink Cel",
    clearCel: "Clear Cel",
    expandPalette: "Expand palette",
    expandTools: "Expand tools",
    size: "Size",
    opacity: "Opacity",
    mirrorX: "Mirror X",
    mirrorY: "Mirror Y",
    undo: "Undo",
    redo: "Redo",
    tool: "Tool",
    canvas: "Canvas",
    zoom: "Zoom",
    project: "Project",
    save: "Save",
    setting: "Setting",
    help: "Help",
    newProject: "New Project...",
    clearProject: "Clear Project",
    loadProject: "Load Project (.dotproj)",
    saveProject: "Save Project (.dotproj)",
    savePng: "Save as PNG...",
    saveGif: "Save as GIF...",
    saveSpritesheet: "Save as Spritesheet...",
    importImageGif: "Import Image/GIF...",
    canvasOptions: "Canvas Options",
    shortcutsInfo: "Shortcuts & Info",
    menu: "Menu",
    informationPolicies: "Information & Policies",
    openMenu: "Open menu",
    openSettings: "Open settings",
  },
  ko: {
    language: "언어",
    english: "EN",
    korean: "KO",
    navGuide: "가이드",
    navAbout: "소개",
    navPrivacy: "개인정보",
    navTerms: "약관",
    aboutContact: "소개 / 문의",
    guideFaq: "가이드 & FAQ",
    privacyPolicy: "개인정보 처리방침",
    termsService: "서비스 약관",
    create: "만들기",
    createPixelArt: "픽셀 아트 만들기",
    readGuide: "가이드 보기",
    openEditor: "에디터 열기",
    badge: "무료 브라우저 픽셀 에디터",
    headline: "브라우저에서 픽셀 아트, 스프라이트, 작은 애니메이션을 만들어보세요.",
    intro:
      "설치 없이 아이콘, 게임 스프라이트, 프레임 애니메이션, 제한 팔레트 아트를 그릴 수 있습니다. 깔끔한 32 x 32 캔버스에서 시작해 완성되면 바로 내보내세요.",
    defaultCanvas: "기본 캔버스",
    frameCels: "프레임 셀",
    exports: "내보내기",
    examplesTitle: "만들 수 있는 것",
    examplesText: "스프라이트, 타일, 아이콘, 애니메이션용 프레임 예시입니다.",
    featurePaletteTitle: "팔레트 명암",
    featurePaletteText: "Lighten과 Darken으로 픽셀을 한 단계씩 조절해 손맛 있는 픽셀 느낌을 유지합니다.",
    featureAnimationTitle: "프레임 애니메이션",
    featureAnimationText: "애니메이션 매트릭스를 만들고 재생을 확인한 뒤 정지 프레임이나 애니메이션으로 내보낼 수 있습니다.",
    featureLocalTitle: "로컬 작업 흐름",
    featureLocalText: "브라우저에서 작업하고 프로젝트 파일을 로컬에 저장해 작업물을 직접 관리할 수 있습니다.",
    builtTitle: "빠른 스프라이트 작업에 맞춘 구성",
    builtText:
      "MAKE PIXEL DOT은 왼쪽 팔레트, 오른쪽 도구, 중앙 캔버스, 아래 타임라인으로 에디터를 간결하게 유지합니다. 홈은 도구를 설명하고, 에디터는 그리기에 집중합니다.",
    useCasesTitle: "픽셀 아트와 스프라이트 작업 활용 예시",
    useCasesText:
      "깔끔한 가장자리, 제한된 색상, 예측 가능한 내보내기 크기가 필요한 작은 창작 에셋에 적합합니다.",
    useCaseSpritesTitle: "게임 스프라이트",
    useCaseSpritesText: "2D 게임용 대기 프레임, 걷기 동작, 소품, 아이템, 이펙트, UI 오브젝트를 스케치할 수 있습니다.",
    useCaseIconsTitle: "아이콘과 타일",
    useCaseIconsText: "파비콘, 앱 아이콘, 인터페이스 심볼, 타일, 배지, 장식용 픽셀 에셋을 만들 수 있습니다.",
    useCaseLearningTitle: "픽셀 아트 연습",
    useCaseLearningText: "작고 집중된 캔버스에서 실루엣, 팔레트 제어, 명암, 프레임 타이밍을 연습할 수 있습니다.",
    workflowTitle: "아이디어에서 내보내기까지의 작업 흐름",
    workflowText:
      "간단한 실루엣으로 시작해 팔레트를 다듬고, 레이어로 디테일을 분리하고, 애니메이션 프레임을 확인한 뒤 프로젝트에 맞는 형식으로 내보내세요.",
    workflowStepOne: "Pencil 도구와 작은 팔레트로 큰 형태를 먼저 잡습니다.",
    workflowStepTwo: "외곽선, 색상, 하이라이트, 그림자, 효과를 레이어로 나눕니다.",
    workflowStepThree: "움직임이 필요하면 프레임이나 매트릭스를 추가합니다.",
    workflowStepFour: "나중에 수정할 수 있도록 .dotproj를 저장하고 PNG, GIF, 스프라이트시트로 내보냅니다.",
    localFirstTitle: "브라우저 기반 로컬 우선 작업",
    localFirstText:
      "MAKE PIXEL DOT은 빠른 브라우저 작업을 위해 설계되었습니다. 그리는 과정은 에디터 안에서 진행되고, 계속 편집하고 싶을 때 프로젝트 파일을 로컬에 저장할 수 있습니다.",
    selectionWorkflow: "선택 도구 흐름",
    selectionWorkflowText: "선택한 픽셀을 복사, 잘라내기, 붙여넣기, 뒤집기, 삭제, 이동할 수 있습니다.",
    exportOptions: "내보내기 옵션",
    exportOptionsText: "에디터에서 PNG, GIF, 스프라이트시트, .dotproj 프로젝트 파일을 저장할 수 있습니다.",
    lightenTool: "밝게 도구",
    lightenToolText: "작은 단계로 하이라이트를 추가합니다.",
    darkenTool: "어둡게 도구",
    darkenToolText: "픽셀을 바로 검게 만들지 않고 자연스럽게 어둡게 조절합니다.",
    footer: "2026 MAKE PIXEL DOT. 브라우저 기반 픽셀 아트 에디터.",
    palette: "팔레트",
    tools: "도구",
    matrix: "매트릭스",
    play: "재생",
    saveDrawing: "그림 저장",
    stopPreview: "미리보기 중지",
    linkPrevious: "이전 셀 연결",
    unlinkCel: "셀 연결 해제",
    clearCel: "셀 지우기",
    expandPalette: "팔레트 펼치기",
    expandTools: "도구 펼치기",
    size: "크기",
    opacity: "불투명도",
    mirrorX: "좌우 대칭",
    mirrorY: "상하 대칭",
    undo: "실행 취소",
    redo: "다시 실행",
    tool: "도구",
    canvas: "캔버스",
    zoom: "줌",
    project: "프로젝트",
    save: "저장",
    setting: "설정",
    help: "도움말",
    newProject: "새 프로젝트...",
    clearProject: "프로젝트 지우기",
    loadProject: "프로젝트 불러오기 (.dotproj)",
    saveProject: "프로젝트 저장 (.dotproj)",
    savePng: "PNG로 저장...",
    saveGif: "GIF로 저장...",
    saveSpritesheet: "스프라이트시트로 저장...",
    importImageGif: "이미지/GIF 가져오기...",
    canvasOptions: "캔버스 옵션",
    shortcutsInfo: "단축키 & 정보",
    menu: "메뉴",
    informationPolicies: "정보 & 정책",
    openMenu: "메뉴 열기",
    openSettings: "설정 열기",
  },
} as const;

const toolCopy: Record<Language, Record<Tool, string>> = {
  en: {
    bucket: "Bucket",
    darken: "Darken",
    ellipse: "Ellipse",
    eraser: "Eraser",
    eyedropper: "Eyedropper",
    lighten: "Lighten",
    line: "Line",
    pencil: "Pencil",
    rectangle: "Rectangle",
    selection: "Selection",
  },
  ko: {
    bucket: "채우기",
    darken: "어둡게",
    ellipse: "타원",
    eraser: "지우개",
    eyedropper: "스포이드",
    lighten: "밝게",
    line: "선",
    pencil: "연필",
    rectangle: "사각형",
    selection: "선택",
  },
};

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "ko" ? "ko" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}
  }, [language]);

  return {
    language,
    setLanguage: setLanguageState,
    t: copy[language],
    toolLabel: (tool: Tool) => toolCopy[language][tool],
  };
}

export function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="inline-flex h-8 shrink-0 items-center border border-zinc-800 bg-zinc-950 font-ui text-[11px] font-black text-zinc-300">
      <span className="grid h-full w-8 place-items-center border-r border-zinc-800 text-amber-300" title={copy[language].language}>
        <Languages size={14} />
      </span>
      {(["en", "ko"] as const).map((item) => (
        <button
          key={item}
          className={`h-full px-2.5 ${
            language === item ? "bg-amber-300 text-zinc-950" : "hover:bg-zinc-800 hover:text-zinc-100"
          }`}
          onClick={() => onChange(item)}
          type="button"
        >
          {item === "en" ? copy[language].english : copy[language].korean}
        </button>
      ))}
    </div>
  );
}
