import fs from 'fs';

let content = fs.readFileSync('App.tsx', 'utf-8');

// Replace root 2xl: with data-[layout=row]:
content = content.replace(/<div className="min-h-screen 2xl:h-screen bg-\[#111116\] text-slate-50 flex flex-col 2xl:flex-row p-4 md:p-6 gap-6 relative overflow-y-auto 2xl:overflow-hidden">/g,
  '<div className="group min-h-screen data-[layout=row]:h-screen bg-[#111116] text-slate-50 flex flex-col data-[layout=row]:flex-row p-4 md:p-6 gap-6 relative overflow-y-auto data-[layout=row]:overflow-hidden" data-layout={isStacked ? "stacked" : "row"}>');

// Replace all other 2xl: with group-data-[layout=row]:
content = content.replace(/2xl:/g, 'group-data-[layout=row]:');

// Add isStacked state
const stateHook = `  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isStacked, setIsStacked] = useState(false);

  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsStacked(width < height + 688 || width < 1024);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);`;

content = content.replace(/  const \[showMobileChat, setShowMobileChat\] = useState\(false\);/, stateHook);

fs.writeFileSync('App.tsx', content);
console.log('Done App.tsx');

let boardContent = fs.readFileSync('components/Board.tsx', 'utf-8');
boardContent = boardContent.replace(/2xl:/g, 'group-data-[layout=row]:');
fs.writeFileSync('components/Board.tsx', boardContent);
console.log('Done Board.tsx');
