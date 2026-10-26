// Restaurant catalogue and display constants, shared by the browser app and the API.

export const RESTAURANTS = [
  {id:'r1',name:'Saffron Courtyard',cuisines:['North Indian'],priceRange:2,area:'Indiranagar',address:'14, 12th Main, HAL 2nd Stage, Indiranagar',hours:[12,23.5],isVeg:false,popularDishes:['Dal Makhani','Paneer Tikka','Butter Naan','Rogan Josh'],addedAt:'2024-02-11'},
  {id:'r2',name:'Banana Leaf Tiffin Co.',cuisines:['South Indian'],priceRange:1,area:'Basavanagudi',address:'88, DVG Road, Basavanagudi',hours:[6.5,22],isVeg:true,popularDishes:['Masala Dosa','Ghee Podi Idli','Filter Coffee','Rava Vada'],addedAt:'2023-08-02'},
  {id:'r3',name:'Red Lantern Wok',cuisines:['Chinese'],priceRange:2,area:'Koramangala',address:'5th Block, 80 Feet Road, Koramangala',hours:[12,23],isVeg:false,popularDishes:['Hakka Noodles','Chilli Garlic Prawns','Dim Sum Basket','Kung Pao Tofu'],addedAt:'2025-01-20'},
  {id:'r4',name:'Trattoria Lucca',cuisines:['Italian'],priceRange:3,area:'Lavelle Road',address:'3, Lavelle Road, Ashok Nagar',hours:[12.5,23.5],isVeg:false,popularDishes:['Cacio e Pepe','Wood-fired Margherita','Burrata','Tiramisu'],addedAt:'2025-06-14'},
  {id:'r5',name:'Morning Ledger Café',cuisines:['Cafe'],priceRange:2,area:'HSR Layout',address:'27th Main, Sector 1, HSR Layout',hours:[7.5,21],isVeg:false,popularDishes:['Shakshuka','Almond Croissant','Cold Brew','Avocado Toast'],addedAt:'2025-09-03'},
  {id:'r6',name:"Nawab's Dum House",cuisines:['Biryani','North Indian'],priceRange:2,area:'Frazer Town',address:'Mosque Road, Frazer Town',hours:[12,25],isVeg:false,popularDishes:['Mutton Dum Biryani','Chicken 65','Mirchi ka Salan','Double ka Meetha'],addedAt:'2024-11-09'},
  {id:'r7',name:'Chowpatty Corner',cuisines:['Street Food'],priceRange:1,area:'Jayanagar',address:'11th Main, 4th Block, Jayanagar',hours:[16,23],isVeg:true,popularDishes:['Pani Puri','Pav Bhaji','Dahi Puri','Vada Pav'],addedAt:'2022-05-18'},
  {id:'r8',name:'Kulfi & Co.',cuisines:['Desserts'],priceRange:1,area:'Malleshwaram',address:'8th Cross, Sampige Road, Malleshwaram',hours:[11,23.5],isVeg:true,popularDishes:['Malai Kulfi','Rose Falooda','Rabri Jalebi','Pista Kulfi'],addedAt:'2024-04-27'},
  {id:'r9',name:'Tandoor Line',cuisines:['North Indian','Biryani'],priceRange:3,area:'MG Road',address:'Level 2, 40 MG Road',hours:[19,24],isVeg:false,popularDishes:['Galouti Kebab','Murgh Malai Tikka','Lucknowi Biryani','Sheermal'],addedAt:'2026-02-15'},
  {id:'r10',name:'Sundal Street',cuisines:['South Indian','Street Food'],priceRange:1,area:'Malleshwaram',address:'15th Cross, Margosa Road, Malleshwaram',hours:[15,22],isVeg:true,popularDishes:['Kuzhi Paniyaram','Mysore Bonda','Neer Dosa','Sundal Cup'],addedAt:'2026-07-01'}
];

export const DISH_PRICE = {'Dal Makhani':340,'Paneer Tikka':380,'Butter Naan':70,'Rogan Josh':520,'Masala Dosa':90,'Ghee Podi Idli':80,'Filter Coffee':35,'Rava Vada':60,'Hakka Noodles':260,'Chilli Garlic Prawns':480,'Dim Sum Basket':320,'Kung Pao Tofu':290,'Cacio e Pepe':690,'Wood-fired Margherita':640,'Burrata':780,'Tiramisu':420,'Shakshuka':360,'Almond Croissant':220,'Cold Brew':240,'Avocado Toast':390,'Mutton Dum Biryani':420,'Chicken 65':280,'Mirchi ka Salan':120,'Double ka Meetha':140,'Pani Puri':60,'Pav Bhaji':140,'Dahi Puri':80,'Vada Pav':40,'Malai Kulfi':90,'Rose Falooda':160,'Rabri Jalebi':130,'Pista Kulfi':110,'Galouti Kebab':650,'Murgh Malai Tikka':590,'Lucknowi Biryani':720,'Sheermal':120,'Kuzhi Paniyaram':70,'Mysore Bonda':50,'Neer Dosa':80,'Sundal Cup':40};

// Placeholder plate colour per cuisine (OKLCH hue), and the dish name painted on each restaurant's plate.
export const HUE = {'North Indian':48,'South Indian':95,'Chinese':25,'Italian':140,'Cafe':60,'Biryani':70,'Street Food':35,'Desserts':350};
export const SIGNATURE = {r1:'Dal Makhani',r2:'Masala Dosa',r3:'Hakka Noodles',r4:'Margherita',r5:'Cold Brew',r6:'Dum Biryani',r7:'Pani Puri',r8:'Pista Kulfi',r9:'Galouti Kebab',r10:'Paniyaram'};

export const WORDS = ['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'];
export const SUBS = [['food','Food'],['service','Service'],['ambience','Ambience'],['value','Value']];
export const PRICE_NOTE = ['', 'under ₹500', '₹500–1,500', '₹1,500+'];
export const VISITS = ['Dine-in','Delivery','Takeaway'];

export const restById = id => RESTAURANTS.find(r => r.id === id);
