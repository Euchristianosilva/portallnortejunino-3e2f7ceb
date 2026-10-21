import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fontData from "@/assets/document/font.base64.txt?raw";
import logoData from "@/assets/document/logo.base64.txt?raw";
import { dossierSections, type Dossier } from "@/lib/dossier";

const ink=rgb(0.1,0.15,0.25), brand=rgb(0.12,0.3,0.64);
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function makeDossierPdf(d:Dossier) {
 const pdf=await PDFDocument.create(); pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(bytes(fontData),{subset:true});
 const logo=await pdf.embedPng(bytes(logoData));
 pdf.setTitle(`Dossiê de inscrição — ${d.snapshot.protocol}`); pdf.setAuthor("Portal Norte Junino");
 let page:PDFPage=pdf.addPage([595.28,841.89]); let y=0;
 const newPage=()=>{page=pdf.addPage([595.28,841.89]);y=770;page.drawRectangle({x:0,y:795,width:595.28,height:47,color:brand});page.drawText("PORTAL NORTE JUNINO",{x:44,y:813,size:11,font,color:rgb(1,1,1)});};
 const width=(s:string,size:number)=>font.widthOfTextAtSize(s,size);
 function lines(text:string,size:number) {
  const result:string[]=[];
  for(const paragraph of text.replace(/\r\n?/g,"\n").split("\n")) {
   let line="";
   for(const word of paragraph.split(" ")) {
    const candidate=line?`${line} ${word}`:word;
    if(width(candidate,size)<=507){line=candidate;continue;}
    if(line){result.push(line);line="";}
    for(const ch of word){if(width(line+ch,size)>507){result.push(line);line="";}line+=ch;}
   }
   result.push(line);
  }
  return result;
 }
 const write=(text:string,size=10.5)=>{for(const paragraph of text.split("\n")){const wrapped=lines(paragraph,size);const height=wrapped.length*size*1.55;if(height<705&&y-height<65)newPage();for(const line of wrapped){if(y<65)newPage();if(line)page.drawText(line,{x:44,y,size,font,color:ink});y-=size*1.55;}}};
 y=770;page.drawRectangle({x:0,y:795,width:595.28,height:47,color:brand});page.drawText("PORTAL NORTE JUNINO",{x:44,y:813,size:11,font,color:rgb(1,1,1)});
 page.drawRectangle({x:44,y:674,width:130,height:90,color:brand});
 const dims=logo.scaleToFit(114,76);page.drawImage(logo,{x:52+(114-dims.width)/2,y:681+(76-dims.height)/2,...dims});y=650;
 for(const section of dossierSections(d)){const height=lines(section.title,15).length*23.25+lines(section.text,10.5).length*16.275+33;if(y<130||(height<705&&y-height<65))newPage();write(section.title,15);y-=9;write(section.text);y-=24;}
 const pages=pdf.getPages();
 pages.forEach((p,i)=>p.drawText(`Protocolo ${d.snapshot.protocol}  |  Página ${i+1} de ${pages.length}`,{x:44,y:35,size:8,font,color:ink}));
 return pdf.save();
}