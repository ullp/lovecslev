Vytvoř nyní projekt pro zadání AI pro: Lovec Slev
Agregátor letáků a akcí z českých obchodů (Lidl, Albert, Kaufland, Billa).
Uživatel zadá nákupní seznam a aplikace najde nejlevnější kombinaci obchodů.



Níže je kompletní zadání projektu, které můžeš vložit do Cline, Cursoru, Windsurfu nebo jiného AI vývojáře.

Projekt: Lovec Slev
Vize produktu
Lovec Slev je mobilní a webová aplikace pro české zákazníky, která agreguje slevové letáky a akční nabídky obchodních řetězců a pomáhá uživatelům najít nejlevnější nákupní variantu podle jejich nákupního seznamu.

Cílem je ušetřit lidem čas i peníze tím, že nemusí procházet několik letáků a porovnávat ceny ručně.

Hlavní problém
Běžná česká domácnost nakupuje ve více řetězcích:

Lidl
Kaufland
Albert
Billa
Penny
Tesco
Globus
Coop
Norma
Uživatelé:

neví, kde je produkt momentálně nejlevnější
musí procházet mnoho letáků
neumí spočítat nejlepší kombinaci obchodů
MVP
Funkce 1: Přehled letáků
Uživatel vidí aktuální letáky obchodů.

Každý leták obsahuje:



{
"store": "Lidl",
"validFrom": "2026-10-14",
"validTo": "2026-10-20",
"products": [
{
"name": "Mléko polotučné",
"price": 19.90,
"unit": "1 l",
"category": "Mléčné výrobky"
}
]
}
Funkce 2: Vyhledávání produktu
Uživatel zadá:

Kuřecí prsa
Systém vrátí:



Lidl ........... 129 Kč/kg
Albert ......... 139 Kč/kg
Billa .......... 149 Kč/kg
Kaufland ....... 135 Kč/kg
Řazení dle ceny.

Funkce 3: Nákupní seznam
Uživatel vytvoří seznam:



Mléko
Máslo
Kuřecí prsa
Banány
Toaletní papír
Aplikace uloží seznam do profilu.

Funkce 4: Nejlevnější nákup
AI optimalizační algoritmus spočítá:

Varianta A
Pouze 1 obchod



Kaufland
Celkem: 865 Kč
Varianta B
Více obchodů



Lidl:
Mléko
Banány

Albert:
Kuřecí prsa

Kaufland:
Máslo
Toaletní papír

Celkem: 742 Kč
Úspora: 123 Kč
Funkce 5: Mapa obchodů
Integrace map.

Zobrazí:

Lidl
Billa
Penny
Albert
Kaufland
v okolí uživatele.

Prémiové funkce
AI Nákupní poradce
Uživatel napíše:



Chci nakoupit na týden pro čtyřčlennou rodinu do 2500 Kč.
AI vytvoří:

nákupní seznam
doporučené produkty
nejlevnější kombinaci obchodů
Hlídač cen
Uživatel uloží produkt:



Nutella 750 g
A nastaví:



Upozorni mě pod 119 Kč.
Push notifikace:



Nutella je nyní v Albertu za 109 Kč.
Historie cen
Graf vývoje ceny.

Například:



Máslo 250 g

leden: 49 Kč
únor: 45 Kč
březen: 52 Kč
duben: 39 Kč
Rodinné sdílení
Více členů domácnosti sdílí:

nákupní seznam
oblíbené produkty
upozornění
Obchodní model
Free
letáky
vyhledávání
základní seznam
Premium 79 Kč/měsíc
optimalizace nákupu
AI poradce
historie cen
cenová upozornění
neomezené seznamy
Technologie
Frontend


React Native
Typescript
Expo
Backend


Node.js
NestJS
Typescript
Databáze


PostgreSQL
Cache


Redis
Vyhledávání


Elasticsearch
Datový model
Product


interface Product {
id: string
name: string
brand?: string
category: string
}
Store


interface Store {
id: string
name: string
latitude: number
longitude: number
}
Promotion


interface Promotion {
id: string
productId: string
storeId: string
price: number
validFrom: Date
validTo: Date
}
ShoppingList


interface ShoppingList {
id: string
userId: string
items: ShoppingListItem[]
}
AI Funkce
Rozpoznání produktu
Uživatel napíše:



Coca cola
AI automaticky přiřadí:



Coca-Cola Original 1.5 l
Oprava překlepů


Mliko
→



Mléko
Chytřejší hledání


toaleťák
→



Toaletní papír
Dlouhodobá vize
Vytvořit „Heuréku pro potraviny“, která:

monitoruje ceny v českých obchodech
hlídá slevy
automaticky plánuje nákupy
doporučuje nejvýhodnější variantu
využívá AI k úspoře peněz domácností
Cíl: stát se hlavní aplikací pro chytré nakupování v Česku a později expandovat na Slovensko, Polsko a Německo.






