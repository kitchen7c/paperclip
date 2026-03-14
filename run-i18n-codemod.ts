import { Project, SyntaxKind, Node } from 'ts-morph';
import * as fs from 'fs';

const zhData = JSON.parse(fs.readFileSync('ui/src/locales/zh/translation.json', 'utf-8'));
const validKeys = new Set(Object.keys(zhData).filter(k => /^[A-Za-z]/.test(k) && k.length < 50));

const project = new Project();
project.addSourceFilesAtPaths('ui/src/**/*.tsx');

let changedFilesCount = 0;

for (const sourceFile of project.getSourceFiles()) {
  let hasChanges = false;

  const jsxTexts = sourceFile.getDescendantsOfKind(SyntaxKind.JsxText);
  for (const jsxText of jsxTexts) {
    const text = jsxText.getLiteralText().replace(/\s+/g, ' ').trim();
    if (validKeys.has(text)) {
      jsxText.replaceWithText(`{t("${text}")}`);
      hasChanges = true;
    }
  }

  const jsxAttributes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);
  for (const attr of jsxAttributes) {
    const init = attr.getInitializer();
    if (init && Node.isStringLiteral(init)) {
      const text = init.getLiteralValue().trim();
      const attrName = attr.getNameNode().getText();
      if (['placeholder', 'label', 'title', 'aria-label', 'description'].includes(attrName) && validKeys.has(text)) {
        attr.setInitializer(`{t("${text}")}`);
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    const importDecl = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === 'react-i18next');
    if (!importDecl) {
      sourceFile.addImportDeclaration({
        namedImports: ['useTranslation'],
        moduleSpecifier: 'react-i18next'
      });
    }

    const functions = sourceFile.getFunctions();
    const arrowFuncs = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
    
    for (const func of [...functions, ...arrowFuncs]) {
      let isComponent = false;
      
      if (Node.isFunctionDeclaration(func)) {
        const name = func.getName();
        if (name && /^[A-Z]/.test(name)) isComponent = true;
      } else if (Node.isArrowFunction(func)) {
        const parent = func.getParent();
        if (Node.isVariableDeclaration(parent)) {
          const name = parent.getName();
          if (name && /^[A-Z]/.test(name)) isComponent = true;
        }
      }

      if (isComponent) {
        const body = func.getBody();
        if (Node.isBlock(body)) {
          const text = body.getText();
          if (!text.includes('useTranslation')) {
            body.insertStatements(0, 'const { t } = useTranslation();');
          }
        } else if (Node.isJsxElement(body) || Node.isJsxFragment(body) || Node.isParenthesizedExpression(body) || Node.isJsxSelfClosingElement(body)) {
          // It's a single expression arrow function component. Need to convert to block.
          const returnExpr = body.getText();
          func.setBodyText(`{\n  const { t } = useTranslation();\n  return ${returnExpr};\n}`);
        }
      }
    }

    sourceFile.saveSync();
    changedFilesCount++;
    console.log(`Transformed: ${sourceFile.getBaseName()}`);
  }
}

console.log(`Done! Modified ${changedFilesCount} files.`);
