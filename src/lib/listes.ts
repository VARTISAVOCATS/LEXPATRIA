// Listes fermées proposées au client à la place d'une saisie libre (préfectures, consulats, titres, visas).
// Les noms propres (préfectures, consulats) ne sont pas traduits.

/** Départements et leur préfecture : la préfecture compétente est celle du département de résidence. */
export const PREFECTURES: [string, string][] = [
  ["01", "Ain (Bourg-en-Bresse)"], ["02", "Aisne (Laon)"], ["03", "Allier (Moulins)"], ["04", "Alpes-de-Haute-Provence (Digne-les-Bains)"],
  ["05", "Hautes-Alpes (Gap)"], ["06", "Alpes-Maritimes (Nice)"], ["07", "Ardèche (Privas)"], ["08", "Ardennes (Charleville-Mézières)"],
  ["09", "Ariège (Foix)"], ["10", "Aube (Troyes)"], ["11", "Aude (Carcassonne)"], ["12", "Aveyron (Rodez)"],
  ["13", "Bouches-du-Rhône (Marseille)"], ["14", "Calvados (Caen)"], ["15", "Cantal (Aurillac)"], ["16", "Charente (Angoulême)"],
  ["17", "Charente-Maritime (La Rochelle)"], ["18", "Cher (Bourges)"], ["19", "Corrèze (Tulle)"], ["2A", "Corse-du-Sud (Ajaccio)"],
  ["2B", "Haute-Corse (Bastia)"], ["21", "Côte-d'Or (Dijon)"], ["22", "Côtes-d'Armor (Saint-Brieuc)"], ["23", "Creuse (Guéret)"],
  ["24", "Dordogne (Périgueux)"], ["25", "Doubs (Besançon)"], ["26", "Drôme (Valence)"], ["27", "Eure (Évreux)"],
  ["28", "Eure-et-Loir (Chartres)"], ["29", "Finistère (Quimper)"], ["30", "Gard (Nîmes)"], ["31", "Haute-Garonne (Toulouse)"],
  ["32", "Gers (Auch)"], ["33", "Gironde (Bordeaux)"], ["34", "Hérault (Montpellier)"], ["35", "Ille-et-Vilaine (Rennes)"],
  ["36", "Indre (Châteauroux)"], ["37", "Indre-et-Loire (Tours)"], ["38", "Isère (Grenoble)"], ["39", "Jura (Lons-le-Saunier)"],
  ["40", "Landes (Mont-de-Marsan)"], ["41", "Loir-et-Cher (Blois)"], ["42", "Loire (Saint-Étienne)"], ["43", "Haute-Loire (Le Puy-en-Velay)"],
  ["44", "Loire-Atlantique (Nantes)"], ["45", "Loiret (Orléans)"], ["46", "Lot (Cahors)"], ["47", "Lot-et-Garonne (Agen)"],
  ["48", "Lozère (Mende)"], ["49", "Maine-et-Loire (Angers)"], ["50", "Manche (Saint-Lô)"], ["51", "Marne (Châlons-en-Champagne)"],
  ["52", "Haute-Marne (Chaumont)"], ["53", "Mayenne (Laval)"], ["54", "Meurthe-et-Moselle (Nancy)"], ["55", "Meuse (Bar-le-Duc)"],
  ["56", "Morbihan (Vannes)"], ["57", "Moselle (Metz)"], ["58", "Nièvre (Nevers)"], ["59", "Nord (Lille)"],
  ["60", "Oise (Beauvais)"], ["61", "Orne (Alençon)"], ["62", "Pas-de-Calais (Arras)"], ["63", "Puy-de-Dôme (Clermont-Ferrand)"],
  ["64", "Pyrénées-Atlantiques (Pau)"], ["65", "Hautes-Pyrénées (Tarbes)"], ["66", "Pyrénées-Orientales (Perpignan)"], ["67", "Bas-Rhin (Strasbourg)"],
  ["68", "Haut-Rhin (Colmar)"], ["69", "Rhône (Lyon)"], ["70", "Haute-Saône (Vesoul)"], ["71", "Saône-et-Loire (Mâcon)"],
  ["72", "Sarthe (Le Mans)"], ["73", "Savoie (Chambéry)"], ["74", "Haute-Savoie (Annecy)"], ["75", "Paris (préfecture de police)"],
  ["76", "Seine-Maritime (Rouen)"], ["77", "Seine-et-Marne (Melun)"], ["78", "Yvelines (Versailles)"], ["79", "Deux-Sèvres (Niort)"],
  ["80", "Somme (Amiens)"], ["81", "Tarn (Albi)"], ["82", "Tarn-et-Garonne (Montauban)"], ["83", "Var (Toulon)"],
  ["84", "Vaucluse (Avignon)"], ["85", "Vendée (La Roche-sur-Yon)"], ["86", "Vienne (Poitiers)"], ["87", "Haute-Vienne (Limoges)"],
  ["88", "Vosges (Épinal)"], ["89", "Yonne (Auxerre)"], ["90", "Territoire de Belfort (Belfort)"], ["91", "Essonne (Évry-Courcouronnes)"],
  ["92", "Hauts-de-Seine (Nanterre)"], ["93", "Seine-Saint-Denis (Bobigny)"], ["94", "Val-de-Marne (Créteil)"], ["95", "Val-d'Oise (Cergy)"],
  ["971", "Guadeloupe (Basse-Terre)"], ["972", "Martinique (Fort-de-France)"], ["973", "Guyane (Cayenne)"], ["974", "La Réunion (Saint-Denis)"],
  ["976", "Mayotte (Mamoudzou)"],
];

/** Consulats et services des visas les plus sollicités ; « Autre consulat » pour le reste. */
export const CONSULATS: [string, string][] = [
  ["alger", "Algérie — Alger"], ["oran", "Algérie — Oran"], ["annaba", "Algérie — Annaba"],
  ["casablanca", "Maroc — Casablanca"], ["rabat", "Maroc — Rabat"], ["fes", "Maroc — Fès"], ["marrakech", "Maroc — Marrakech"],
  ["tanger", "Maroc — Tanger"], ["agadir", "Maroc — Agadir"],
  ["tunis", "Tunisie — Tunis"],
  ["dakar", "Sénégal — Dakar"], ["abidjan", "Côte d'Ivoire — Abidjan"], ["bamako", "Mali — Bamako"], ["conakry", "Guinée — Conakry"],
  ["yaounde", "Cameroun — Yaoundé"], ["douala", "Cameroun — Douala"], ["kinshasa", "RD Congo — Kinshasa"], ["brazzaville", "Congo — Brazzaville"],
  ["libreville", "Gabon — Libreville"], ["lome", "Togo — Lomé"], ["cotonou", "Bénin — Cotonou"], ["ouagadougou", "Burkina Faso — Ouagadougou"],
  ["niamey", "Niger — Niamey"], ["nouakchott", "Mauritanie — Nouakchott"], ["antananarivo", "Madagascar — Antananarivo"],
  ["le-caire", "Égypte — Le Caire"], ["beyrouth", "Liban — Beyrouth"], ["istanbul", "Turquie — Istanbul"], ["ankara", "Turquie — Ankara"],
  ["moscou", "Russie — Moscou"], ["kiev", "Ukraine — Kiev"], ["new-delhi", "Inde — New Delhi"], ["pekin", "Chine — Pékin"],
  ["islamabad", "Pakistan — Islamabad"], ["dacca", "Bangladesh — Dacca"], ["kaboul", "Afghanistan — Kaboul"],
  ["port-au-prince", "Haïti — Port-au-Prince"], ["bogota", "Colombie — Bogota"], ["sao-paulo", "Brésil — São Paulo"],
  ["autre", "Autre consulat"],
];

/** Visa d'entrée en France. */
export const VISAS_ENTREE: [string, string][] = [
  ["court_tourisme", "Visa court séjour (Schengen) : tourisme ou visite"],
  ["court_affaires", "Visa court séjour (Schengen) : affaires ou mission"],
  ["court_famille", "Visa court séjour (Schengen) : visite familiale"],
  ["long_etudiant", "Visa long séjour : étudiant"],
  ["long_salarie", "Visa long séjour : salarié ou travailleur temporaire"],
  ["long_conjoint", "Visa long séjour : conjoint de Français"],
  ["long_famille", "Visa long séjour : regroupement familial ou vie privée et familiale"],
  ["long_visiteur", "Visa long séjour : visiteur"],
  ["long_talent", "Visa long séjour : passeport talent"],
  ["long_autre", "Visa long séjour : autre motif"],
  ["sans", "Sans visa"],
  ["nsp", "Je ne sais pas"],
];

/** Titres de séjour (droit commun). */
export const TITRES: [string, string][] = [
  ["vpf", "Carte de séjour « vie privée et familiale »"],
  ["salarie", "Carte de séjour « salarié »"],
  ["travailleur_temporaire", "Carte de séjour « travailleur temporaire »"],
  ["etudiant", "Carte de séjour « étudiant »"],
  ["talent", "Carte « passeport talent »"],
  ["conjoint", "Carte de séjour de conjoint de Français"],
  ["parent", "Carte de séjour de parent d'enfant français"],
  ["resident", "Carte de résident (dix ans)"],
  ["recepisse", "Récépissé ou autorisation provisoire de séjour seulement"],
  ["autre", "Autre ou je ne sais pas"],
];

/** Certificats de résidence algériens (accord franco-algérien du 27 décembre 1968). */
export const CERTIFICATS: [string, string][] = [
  ["vpf", "Certificat de résidence d'un an « vie privée et familiale »"],
  ["conjoint", "Certificat de résidence de conjoint de Français"],
  ["parent", "Certificat de résidence de parent d'enfant français"],
  ["salarie", "Certificat de résidence « salarié »"],
  ["etudiant", "Certificat de résidence « étudiant »"],
  ["dix", "Certificat de résidence de dix ans"],
  ["recepisse", "Récépissé ou autorisation provisoire de séjour seulement"],
  ["autre", "Autre ou je ne sais pas"],
];

export const NOMBRES_ENFANTS: [string, string][] = [
  ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6 ou plus"],
];
