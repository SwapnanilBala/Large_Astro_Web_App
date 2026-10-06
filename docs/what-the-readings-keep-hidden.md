# What the readings keep hidden

The classical notes in the app quote three old books:

- the **Brihat Jataka** (N. Chidambaram Iyer's 1885 translation), for everyone;
- B. Suryanarain Rao's **Strijataka, or Female Horoscopy** (1931), for readers who said they are a woman;
- the **Brihat Samhita** (1884 translation), whose passages about the hand feed the palm reading.

Each book is split into short passages, and some are never shown to readers. This file says what we hide and why, in the owner's own words where they decided it. Then it lists every hidden passage.

Hidden passages are not deleted. They stay in `lib/knowledge/corpus/*.json`, marked `withheld: true` with a reason, so each corpus stays a complete, checkable copy of its book. The database loads them too, but every query filters them out (`lib/knowledge/retrieve.ts`). So they never reach the model that writes a note, the sources listed under a note, or the palm reading.

## The line we draw

The owner's rule, set on 2026-10-04 while the Brihat Jataka was being prepared:

> "it's fine if people hear that from an astrologer but for a project, this kind of information is not appropriate, it might give people second thoughts, but wife or husband leaving that's fine ... death/blindness is too much"

An astrologer sitting with a client can soften a hard prediction; a page in an app cannot. So a reading may describe turbulence a reader can live with: a partner leaving, several marriages, few children or none, desire, adultery. It never shows something that would frighten a reader or brand them.

## What we hide

### Death, widowhood and lifespan

- **Any prediction of death:** a short life, the manner of death, a partner's death (widowhood, in the chapters on women), a child's death. The owner confirmed the last when asked: "No do not show the child death."
- **In the palm reading, any lifespan, even a long one:** "Lines reaching the root of the forefinger indicate the age of the person to be 100". The reading tells the reader that no line on the hand fixes a lifespan, so it must not quote one that does.

### Illness, injury, disability and deformity

Disease, wounds, blindness, bodily defects. The reason is the same as for death: "death/blindness is too much".

Some things are still shown. Words the books use for a temperament or body type, such as phlegmatic, bilious or windy, describe a type, not an illness. Favourable statements ("free from disease") are shown too.

### Caste and birth status

- **Any mention of caste or low birth,** even in passing ("learned in the handicraft of men of low castes").
- **Any slur on someone's birth:** "born of adultery", or a son who "is not the son of his reputed or registered father".
- **Relations with "women under prohibition",** that is, forbidden by kinship or caste. These are grouped with caste.

Caste was ruled out in the first rules the corpus was built on, and the owner's later decisions kept that rule. Slurs on birth fall under the same rule.

The one exception is a respectful mention of Brahmins ("fond of Brahmins", "will respect the Devas, Brahmins, and holy men"). These are reworded rather than hidden; see below. A note that only defines an ascetic order as "a Brahman ascetic" stays hidden, because the rewording would make a beggar-monk into a person of high status.

### Crime, violence and imprisonment

Theft, robbery, torture, imprisonment, killing or poisoning a husband, "will engage in duels". A temperament that is only quarrelsome or "fond of fight" is shown, as it always has been.

### Harm to a parent, partner or child

A prediction that the reader will harm their family, or that their family will come to harm.

### Eunuchs and hermaphrodites

Never shown, whatever the context. Rebuilding the Brihat Jataka let three such passages through, so they are hidden by hand. One would have reached women with Mercury in the 7th house.

### Words the owner chose to keep hidden

On 2026-10-05 the owner read every word in the books that brands a person, and decided each one. Two stay hidden for good: "keep the 'a woman of low deeds' and 'dirty women' hidden".

### The malefic-yogas chapter

The Brihat Jataka's chapter 23, "On Malefic Yogas", predicts nothing but misfortune. Judging it verse by verse once let one of its predictions (a spouse leaving) reach readers through unrelated yogas. So the whole chapter is hidden, except three marriage passages the owner chose on 2026-10-04:

- a spouse leaving;
- several marriages;
- marrying late.

### A sentence broken by a missing page

The Strijataka's scan lacks five pages: 3, 7, 8, 10 and 38. Where the text before and after a gap reads like one sentence, joining them would pin one page's result on another page's condition. That passage is hidden.

## What we reword instead of hiding

Some words are too harsh to print but say something the owner wants readers to hear. These are replaced, in square brackets, with the owner's wording. The brackets mark the words as ours, and each card's credit line says so. The book's own words are kept in the corpus as `printedText` and never shown.

- **Words for a prostitute** (prostitute, whore, harlot, courtesan) become "[multiple illicit relationships]". The owner: "calling prostitute is a bit too bold and some people might get hurt we have to reframe that wording like multiple illicit relationships would be a better".
- **"Immoral" and "bad women"** become "[multiple illicit relationships]" too ("keep multiple illicit relationships").
- **"Barren"** becomes "[may have no children]" ("show barren as 'may have no children'").
- **Brahmins, spoken of with respect or liking,** become "[people of very high status and influence]": "fond of [people of very high status and influence]" ("Fond of Bhramins change it to liking of people with very high status and influential people"). Mars and Jupiter's "will be a Brahmin" becomes "will be [a person of very high status and influence]". Every other mention of caste stays hidden.

A build fails if a passage it would show still prints one of these words.

## What we show, though it may look harsh

- **A spouse leaving,** separation, remarriage, marrying late, several marriages (2026-10-04).
- **Few children or none,** and plainly sexual traits: "do not hold them, they are inherently not a problem" (2026-10-04).
- **Adultery, for women and for men:** "Adultery is fine, not too bad, same do it for men as well" (2026-10-05). This includes the books' other words for it, "free with other men", "going wrong" and "free in her sexual intercourse" ("these sound alright").
- **"Unchaste", "bad character" and "questionable morals":** "Unchaste sounds fine ... bad character is fine and then keep the questionable morals". "Bad character" covers its variants: "of bad conduct", "a bad one", "bad in morality".
- **Poverty, servitude and hard work,** and the character words the Brihat Jataka has always used, such as sinful, wicked or cruel.

The notes written from these passages still speak gently:

- They say "your partner", never the books' "husband" or "wife".
- They speak of sexual matters only as romance, warmth or attraction.
- They name a harsh verdict in one neutral phrase, never as an insult.

The palm reading names no text at all: "no need to mention the citation on the palm reading mode".

## How it is kept

- The build scripts (`scripts/knowledge/build-*.ts`) carry these rules in their prompts. The owner's later decisions live in `scripts/knowledge/build-shared.ts` and in each script's `PASSAGE_OVERRIDES`. So a rebuild from Claude's cached answers reproduces every decision without asking again.
- `lib/__tests__/knowledge-corpus.test.ts` fails if a shown passage names death, caste, crime and the rest. It also checks each of the owner's decisions.
- A harsh word nobody has decided on yet stays hidden until the owner chooses its wording.
- The rest of this file is generated. Run `npm run knowledge:hidden-report` after a build; a test fails when it is out of date.

<!-- hidden-report:start (generated by npm run knowledge:hidden-report; do not edit by hand) -->

## How many, by kind

| Kind | Brihat Jataka | Brihat Samhita | Strijataka |
| --- | ---: | ---: | ---: |
| The malefic-yogas chapter, hidden whole | 50 | 0 | 0 |
| Words the owner chose to keep hidden | 1 | 0 | 1 |
| A sentence broken by a missing page | 0 | 0 | 1 |
| Eunuchs and hermaphrodites | 3 | 1 | 0 |
| Death, widowhood and lifespan | 24 | 46 | 29 |
| Caste and birth status | 13 | 7 | 5 |
| Harm to a parent, partner or child | 3 | 0 | 2 |
| Crime, violence and imprisonment | 28 | 4 | 1 |
| Illness, injury, disability and deformity | 61 | 7 | 40 |
| **Hidden in all** | **183** of 949 | **65** of 366 | **79** of 728 |

A passage is counted under the first kind its recorded reason names, in the order above.

## Every hidden passage

Grouped by kind, then by book and place in the book. Each line gives the passage's id, the reason recorded for it, and how it begins.

### The malefic-yogas chapter, hidden whole (50)

- `brihat-jataka-1885:23.1.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If at the time of birth of a person the 5th and 7th houses from the ascendant or from the Moon be either oc..."
- `brihat-jataka-1885:23.1.2`: The chapter on malefic yogas, which predicts only misfortune. -- "If Virgo be the rising sign and if the Sun occupy it, the person will lose his wife provided Saturn occupie..."
- `brihat-jataka-1885:23.1.3`: The chapter on malefic yogas, which predicts only misfortune. -- "[If Virgo be the rising sign and if the Sun occupy it, the person] will lose his sons if Mars occupy sign C..."
- `brihat-jataka-1885:23.1.5`: The chapter on malefic yogas, which predicts only misfortune. -- "If the 7th house be aspected by the Moon and Saturn the number of wives of a person will be the number repr..."
- `brihat-jataka-1885:23.1.6`: The chapter on malefic yogas, which predicts only misfortune. -- "If Jupiter or the Moon and Venus occupy the 7th house and the Navamsa of the Sun or Mars, the person will h..."
- `brihat-jataka-1885:23.2.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, malefic planets occupy the 4th and 8th houses from Venus or if malefi..."
- `brihat-jataka-1885:23.3.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, one of the two houses, the 12th and the 6th, from the ascendant be oc..."
- `brihat-jataka-1885:23.3.2`: The chapter on malefic yogas, which predicts only misfortune. -- "Again, if Venus and the Sun (a) occupy one of the three houses the 7th, the 9th and the 5th from the ascend..."
- `brihat-jataka-1885:23.3.3`: The chapter on malefic yogas, which predicts only misfortune. -- "(a.) Venus or the Moon according to some. This is opposed to Garga whom the commentator quotes."
- `brihat-jataka-1885:23.4.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, Saturn occupy the rising sign (a) and if Venus occupy the Chakra-sand..."
- `brihat-jataka-1885:23.4.2`: The chapter on malefic yogas, which predicts only misfortune. -- "Again, if the malefic planets occupy the 12th and the 7th houses and the ascendant and the waning Moon occu..."
- `brihat-jataka-1885:23.4.3`: The chapter on malefic yogas, which predicts only misfortune. -- "(b.) If the person will marry again, he may get sons according to some."
- `brihat-jataka-1885:23.5.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, Venus occupy the 7th house from the ascendant and be in the varga (di..."
- `brihat-jataka-1885:23.5.2`: The chapter on malefic yogas, which predicts only misfortune. -- "Again, if when Venus occupies the varga of Saturn or Mars and is aspected by Saturn or Mars, the Moon, Satu..."
- `brihat-jataka-1885:23.5.3`: The chapter on malefic yogas, which predicts only misfortune. -- "Again, if when Venus and the Moon occupy a sign, Saturn and Mars occupy the 7th house from the ascendant, t..."
- `brihat-jataka-1885:23.6.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If at the time of birth of a person the Moon occupy the 10th house, Venus the 7th house and the malefic pla..."
- `brihat-jataka-1885:23.6.2`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth, Saturn occupy a Kendra house and aspect a sign the Drekkana of whose lord may be..."
- `brihat-jataka-1885:23.6.3`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth, Venus occupy the 12th house from the ascendant and the Navamsa of Saturn, the per..."
- `brihat-jataka-1885:23.6.4`: The chapter on malefic yogas, which predicts only misfortune. -- "if at the time of birth the Sun and the Moon occupy the 7th house and be aspected by Saturn, the person wil..."
- `brihat-jataka-1885:23.7.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, Venus and Mars occupy the 7th house from the ascendant and be aspecte..."
- `brihat-jataka-1885:23.7.2`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the Moon occupy the Navamsa of Cancer or Scorpio and be accompanied b..."
- `brihat-jataka-1885:23.7.3`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth, the Moon occupy the ascendant, Saturn and Mars occupy the [?] and 2nd houses and..."
- `brihat-jataka-1885:23.7.4`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the Moon occupy the 10th house from the ascendant, Mars the 7th house..."
- `brihat-jataka-1885:23.8.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the Moon occupy a place between Saturn and Mars and the Sun occupy si..."
- `brihat-jataka-1885:23.8.2`: The chapter on malefic yogas, which predicts only misfortune. -- "if at the time of birth, the Sun occupy the sign or the Navamsa of the Moon, the person will be afflicted w..."
- `brihat-jataka-1885:23.8.3`: The chapter on malefic yogas, which predicts only misfortune. -- "if the Sun and the Moon occupy together either Cancer or Leo, the person will be reduced to a skeleton."
- `brihat-jataka-1885:23.9.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the Moon occupy the 5th Navamsa of Sagittari (a) or the Navamsa of Pi..."
- `brihat-jataka-1885:23.9.2`: The chapter on malefic yogas, which predicts only misfortune. -- "Again, if the 5th or the 9th house from the ascendant be sign Scorpio, Cancer, Taurus, or Capricorn and be..."
- `brihat-jataka-1885:23.9.3`: The chapter on malefic yogas, which predicts only misfortune. -- "(c.) According to Yavanacharya, if the Moon be aspected by benefic planets also at the same time, the perso..."
- `brihat-jataka-1885:23.10.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the Sun, the Moon, Mars and Saturn occupy the 8th, 6th, 2nd and 12th..."
- `brihat-jataka-1885:23.11.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the malefic planets (a) occupy the 9th, 11th, 3rd and 5th houses and..."
- `brihat-jataka-1885:23.11.2`: The chapter on malefic yogas, which predicts only misfortune. -- "if such malefic planets (b) occupy the 7th house from the ascendant, the person will be of deformed teeth."
- `brihat-jataka-1885:23.12.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person the eclipsed Moon occupy the rising sign and if Saturn and Mars occupy..."
- `brihat-jataka-1885:23.12.2`: The chapter on malefic yogas, which predicts only misfortune. -- "Again, if, at the time of birth, the eclipsed Sun occupy the rising sign and if Saturn and Mars occupy the..."
- `brihat-jataka-1885:23.13.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, Saturn occupy the 7th house and Jupiter the ascendant, such person wi..."
- `brihat-jataka-1885:23.13.2`: The chapter on malefic yogas, which predicts only misfortune. -- "if, at the time of birth, Mars occupy the 7th house and Jupiter the ascendant, the person will become insane."
- `brihat-jataka-1885:23.13.3`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth, Saturn occupy the ascendant and Mars occupy the 5th, [?] or 9th house, the person..."
- `brihat-jataka-1885:23.13.4`: The chapter on malefic yogas, which predicts only misfortune. -- "Also, if, at the time of birth, the waning Moon and Saturn occupy the 12th house, the person will also beco..."
- `brihat-jataka-1885:23.14.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, one of the four planets — the lord of the Navamsa occupied by the Moo..."
- `brihat-jataka-1885:23.14.2`: The chapter on malefic yogas, which predicts only misfortune. -- "[the four planets — the lord of the Navamsa occupied by the Moon, the Sun, the Moon, and Jupiter —] if two..."
- `brihat-jataka-1885:23.14.3`: The chapter on malefic yogas, which predicts only misfortune. -- "[the four planets — the lord of the Navamsa occupied by the Moon, the Sun, the Moon, and Jupiter —] if thre..."
- `brihat-jataka-1885:23.15.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the rising sign be Taurus, Aries or Sagittari and if malefic planets..."
- `brihat-jataka-1885:23.15.2`: The chapter on malefic yogas, which predicts only misfortune. -- "if, at the time of birth, one of the malefic signs (a) or sign Sagittari or sign Taurus be the rising sign..."
- `brihat-jataka-1885:23.15.3`: The chapter on malefic yogas, which predicts only misfortune. -- "if the Sun occupy the 9th or the 5th house from the ascendant and if he be aspected by malefic planets the..."
- `brihat-jataka-1885:23.15.4`: The chapter on malefic yogas, which predicts only misfortune. -- "if, at the time of birth, Saturn occupy the 5th or the 9th house and be aspected by malefic planets, the pe..."
- `brihat-jataka-1885:23.15.5`: The chapter on malefic yogas, which predicts only misfortune. -- "if at the time of birth, Mars occupy the 5th or the 9th house and be aspected by malefic planets, the perso..."
- `brihat-jataka-1885:23.16.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the malefic planets occupy the 12th, [?], 2nd, and 9th houses in any..."
- `brihat-jataka-1885:23.16.2`: The chapter on malefic yogas, which predicts only misfortune. -- "Again, if, at the time of birth, the rising Drekkana be either a Sarpa (b) (snake) Drekkana or a Pasa (c) (..."
- `brihat-jataka-1885:23.17.1`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth of a person, the Moon be accompanied by Saturn, aspected by Mars and be surrounded..."
- `brihat-jataka-1885:23.17.2`: The chapter on malefic yogas, which predicts only misfortune. -- "If, at the time of birth, the Sun, Saturn and Mars occupy the 10th house from the ascendant and if they be..."

### Words the owner chose to keep hidden (2)

- `brihat-jataka-1885:18.20.75`: the owner keeps "a woman of low deeds" hidden -- "[A person born when the rising sign is Pisces] will join a woman of low deeds"
- `strijataka-1931:12.10.1`: the owner keeps "dirty women" hidden; also husband's death, poisoning of husbands, mention of caste -- "For a respectable, loving, chaste and modest woman, nothing can be more dreadful than the loss of her lawfu..."

### A sentence broken by a missing page (1)

- `strijataka-1931:4.5.1`: joins two pages across the missing page 10 -- "Suppose Chandra is in Kataka with Guru there husband will be learned and intellectual."

### Eunuchs and hermaphrodites (4)

- `brihat-jataka-1885:17.3.6`: speaks of hermaphrodites -- "[A person born with the Moon in sign Gemini] will join in sexual union with hermaphrodites; and will posses..."
- `brihat-jataka-1885:24.4.7`: speaks of hermaphrodites -- "[when the rising sign or the sign occupied by the Moon at the time of birth of a woman is either Gemini or..."
- `brihat-jataka-1885:24.8.2`: speaks of hermaphrodites -- "[If, at the time of birth of a woman, the 7th house from the rising sign or from the sign occupied by the M..."
- `brihat-samhita-1884:68.41.1`: hermaphrodite -- "If the nail resemble the husk of paddy, the person will be a hermaphrodite ;"

### Death, widowhood and lifespan (99)

- `brihat-jataka-1885:14.4.96`: Short life. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (3). The Sun, Moon..."
- `brihat-jataka-1885:18.19.1`: statement about death -- "A person born with Saturn in sign Sagittari or Pisces will die an excellent death,"
- `brihat-jataka-1885:18.20.8`: manner of death -- "[A person born when Aries is the rising sign] and will meet his death either by weapons or by poison or by..."
- `brihat-jataka-1885:18.20.15`: injury; manner of death -- "[A person born when Taurus is the rising sign] and will suffer from weapons. He will meet his death by weap..."
- `brihat-jataka-1885:18.20.21`: manner of death -- "[A person born when the rising sign is Gemini] He will meet his death by snake-bite, poison, animals or by..."
- `brihat-jataka-1885:18.20.25`: loss of children -- "[A person born when the rising sign is Cancer] will lose his children,"
- `brihat-jataka-1885:18.20.29`: manner of death -- "[A person born when the rising sign is Cancer] He will meet his death by means of a neck ornament or a rope..."
- `brihat-jataka-1885:18.20.34`: disease; manner of death -- "[A person born when the rising sign is Leo] and will have a diseased waist, knees and teeth. He will meet h..."
- `brihat-jataka-1885:18.20.40`: manner of death -- "[A person born when the rising sign is Virgo] He will meet his death by means of quadrupeds, weapons, bilio..."
- `brihat-jataka-1885:18.20.45`: loss of spouse -- "[A person born when Libra is the rising sign] will lose his wife,"
- `brihat-jataka-1885:18.20.47`: manner of death -- "[A person born when Libra is the rising sign] He will meet his death by a famous man, by his kinsmen, by mi..."
- `brihat-jataka-1885:18.20.51`: disease; violence; manner of death -- "[A person born when the rising sign is Scorpio] will suffer from numerous diseases and will surrender himse..."
- `brihat-jataka-1885:18.20.59`: disease; manner of death -- "[A person born when the rising sign is Sagittari] and will have a diseased face. He will meet his death by..."
- `brihat-jataka-1885:18.20.65`: disease; manner of death -- "[A person born when the rising sign is Capricorn] will have a large body, few hairs and weak knees and will..."
- `brihat-jataka-1885:18.20.70`: disease; manner of death -- "[A person born when the rising sign is Aquarius] and will suffer from phlegmatic attacks affecting the ches..."
- `brihat-jataka-1885:18.20.76`: disease; manner of death -- "[A person born when the rising sign is Pisces] and will have bad enemies. He will meet his death by disease..."
- `brihat-jataka-1885:20.10.4`: danger to life -- "Again, if a benefic planet occupy the 8th house, a person will be freed from dangers to life and if a malef..."
- `brihat-jataka-1885:21.8.4`: death of spouse -- "[A person born when Saturn occupies his own Trimsamsa] his wife will die before him,"
- `brihat-jataka-1885:24.1.1`: speaks of the husband's death -- "The same remarks apply to the horoscopy of women as to the horoscopy of men; but the effects which are suit..."
- `brihat-jataka-1885:24.5.2`: violence and death of spouse -- "[When the rising sign or the sign occupied by the Moon at the time of birth of a woman is Cancer, if the ri..."
- `brihat-jataka-1885:24.8.5`: death of spouse -- "[If, at the time of birth of a woman, the 7th house from the rising sign or from the sign occupied by the M..."
- `brihat-jataka-1885:24.9.1`: death of spouse -- "If the 7th house, from the rising sign or from the sign occupied by the Moon at the time of birth of a woma..."
- `brihat-jataka-1885:24.14.1`: death of spouse -- "If, at the time of birth of a woman, the 8th house from the ascendant be occupied by a malefic planet, the..."
- `brihat-jataka-1885:24.14.2`: death -- "If the 8th house be occupied by a malefic planet and if the 2nd house be occupied by a benefic planet the w..."
- `brihat-samhita-1884:68.3.3`: death of family members -- "[the feet] if of brown color, his family will perish ;"
- `brihat-samhita-1884:68.6.1`: death -- "If there be no flesh in the knees, the person will die in his travels ;"
- `brihat-samhita-1884:68.6.6`: lifespan -- "[the knees] and if large, he will live long."
- `brihat-samhita-1884:68.7.9`: disease and death -- "and if the penis be soft, he will die of urinary and the like diseases."
- `brihat-samhita-1884:68.9.1`: death -- "A person with a single testicle will suffer death by drowning;"
- `brihat-samhita-1884:68.9.4`: early death -- "[the testicles] if they be raised up, the person will not live long ;"
- `brihat-samhita-1884:68.9.5`: lifespan -- "[the testicles] and if they hang down he will live to the age of 100 years."
- `brihat-samhita-1884:68.16.3`: lifespan -- "A person whose sexual intercourse lasts for a short time, will live long ;"
- `brihat-samhita-1884:68.16.4`: early death -- "[A person whose sexual intercourse lasts for a short time,] if otherwise, he will die early."
- `brihat-samhita-1884:68.23.1`: lifespan -- "If the navel extend on both sides horizontally, the person will live long ;"
- `brihat-samhita-1884:68.24.1`: violent death -- "If there be one, two, three or four folds of skin in the belly, the person will die wounded by a weapon, wi..."
- `brihat-samhita-1884:68.29.4`: violent death -- "[the bosom] if uneven, he will be poor and die by a weapon."
- `brihat-samhita-1884:68.31.3`: violent death -- "[the neck] and if it be like that of the ox, he will die by a weapon."
- `brihat-samhita-1884:68.37.2`: violent death -- "[the fingers of the hand] and if bent upwards, he will die by weapons."
- `brihat-samhita-1884:68.42.3`: lifespan -- "If the joints of the fingers be long, the person will be popular and will live long."
- `brihat-samhita-1884:68.50.1`: lifespan -- "Lines reaching the root of the forefinger indicate the age of the person to be 100; if the line be of short..."
- `brihat-samhita-1884:68.58.1`: death -- "If the ears be without flesh, the person will die an unnatural death ;"
- `brihat-samhita-1884:68.59.1`: lifespan -- "If the ears be covered with hair, the person will live long ;"
- `brihat-samhita-1884:68.60.4`: lifespan -- "[the nose] and if it be dry, he will live long."
- `brihat-samhita-1884:68.61.4`: violent death -- "[the nose] and if flat, he will be killed by a woman."
- `brihat-samhita-1884:68.63.2`: lifespan -- "[the sneeze] and if it be long and of the same sound throughout, he will live long."
- `brihat-samhita-1884:68.68.1`: early death -- "If the brows be high and not broad, the person will die early ;"
- `brihat-samhita-1884:68.72.1`: violent death, imprisonment and violence -- "If the fore-head be low, the person will be assassinated or put in prison and will be addicted to cruel dee..."
- `brihat-samhita-1884:68.75.1`: lifespan -- "If there be three long lines in the forehead, the person will live for 100 years ;"
- `brihat-samhita-1884:68.75.2`: lifespan -- "[the forehead] if four lines, he will be a king and will live for 93 years."
- `brihat-samhita-1884:68.76.2`: lifespan -- "if there be no lines in the forehead, he will live for 90 years ;"
- `brihat-samhita-1884:68.76.3`: lifespan -- "and if the lines be near the hair of the head, he will live for 80 years."
- `brihat-samhita-1884:68.77.1`: lifespan -- "If there be five lines in the forehead, his age will be 70 ;"
- `brihat-samhita-1884:68.77.2`: lifespan -- "if the lines be of the same length, his age will be sixty ;"
- `brihat-samhita-1884:68.77.3`: lifespan -- "if there be many lines, the age will be 50 ;"
- `brihat-samhita-1884:68.77.4`: lifespan -- "and if the lines be bent, it will be 40."
- `brihat-samhita-1884:68.78.1`: lifespan -- "If the lines in the forehead be in contact with the brows, the age will be 30 ;"
- `brihat-samhita-1884:68.78.2`: lifespan -- "[the lines in the forehead] if they be bent on the left side, it will be 20 ;"
- `brihat-samhita-1884:68.78.3`: early death -- "[the lines in the forehead] if short, the person will meet with early death."
- `brihat-samhita-1884:68.78.4`: lifespan -- "If the lines be imperfect, the age shall be ascertained by proportion."
- `brihat-samhita-1884:68.79.3`: death of a parent -- "[the head] if flat, he will lose his parent when young ;"
- `brihat-samhita-1884:68.79.4`: lifespan -- "[the head] and if long, he will live long."
- `brihat-samhita-1884:68.93.1`: death, imprisonment and disease -- "The complexion which is [?], not glossy, black and of bad odour is caused by the element of air. It will ca..."
- `brihat-samhita-1884:70.11.2`: predicts lifespan -- "if the palm of the hand be neither deep, nor high, if it be covered with benefic lines, the woman will live..."
- `brihat-samhita-1884:70.13.1`: predicts lifespan -- "If there be found a line issuing from below the little finger and reaching a place between the forefinger a..."
- `brihat-samhita-1884:70.14.2`: predicts death of children and lifespan -- "If the lines be perfect, the children will live long, and if broken or short they will die early."
- `brihat-samhita-1884:70.18.2`: predicts death of family -- "[the neck] if very long, her family will perish;"
- `brihat-samhita-1884:70.20.1`: predicts death of a relative -- "If the forehead be low, the brother of the woman's husband will die;"
- `brihat-samhita-1884:70.20.2`: predicts death of a relative -- "if the belly be found to hang, her father-in-law will die;"
- `brihat-samhita-1884:70.20.3`: predicts death of spouse -- "if the buttocks be found to hang, her husband will die;"
- `brihat-samhita-1884:70.24.2`: states a lifespan -- "120 Years is the maximum length of life and each dasa period consists of 12 years. If, for instance, there..."
- `strijataka-1931:2.5.3`: poisoning or killing the husband -- "Take a woman, not given to much adultery, but attached to one bad man, and tries to poison or kill her husb..."
- `strijataka-1931:5.2.3`: predicts widowhood -- "If evil planets occupy the 7th house she becomes a widow."
- `strijataka-1931:6.4.5`: Vishakanya implies harm or death to the husband -- "If two planets are in the 6th and there is one evil and one benefic in Lagna the girl will become a Vishaka..."
- `strijataka-1931:6.7.1`: early widowhood -- "If seventh is occupied by evil planets she will become a widow, early in life."
- `strijataka-1931:6.7.3`: early widowhood -- "If Kuja occupies 7th and has the aspect of an unfriendly planet, she will become a widow, in early life."
- `strijataka-1931:6.7.4`: early widowhood -- "If Sani occupies 7th with unfriendly aspect, she becomes a young widow and will live as a widow till old age."
- `strijataka-1931:6.7.6`: early widowhood -- "If 7th is an evil sign and is occupied by Sani and Kuja, she becomes a widow, very early in life."
- `strijataka-1931:6.7.7`: widowhood -- "If Kuja with an evil planet joins 12th or 8th and Lagna is occupied by Rahu she will become a widow and imm..."
- `strijataka-1931:6.7.9`: widowhood -- "If Ravi, Kuja and Rahu occupy Lagna, she becomes a widow and immoral."
- `strijataka-1931:6.7.11`: mentions early widowhood -- "There are extraordinary women who although they become widows at a very early age, preserve their chastity..."
- `strijataka-1931:6.8.1`: widowhood -- "If there is an evil planet in the 8th from Lagna and when the sub period of the lord of the Navamsa, occupi..."
- `strijataka-1931:6.8.2`: her death -- "If the 2nd is occupied by benefics and the 8th by malefics, she will die before her husband."
- `strijataka-1931:6.8.3`: discusses her death -- "Such a death is coveted by all good women and that state of marital life goes under the name of Sumangali."
- `strijataka-1931:6.8.4`: widowhood -- "If evil planets occupy 8th, the woman becomes a widow."
- `strijataka-1931:6.8.5`: her death -- "If there is a malefic in the 8th and a benefic occupies Kumbha she dies before her husband."
- `strijataka-1931:6.8.6`: her death -- "If Lagna has evil and good planets and the second has benefics her death occurs before her husband."
- `strijataka-1931:6.10.3`: death of children -- "If Rahu and Ravi occupy the 7th she will have dead children."
- `strijataka-1931:7.30.1`: speaks of death -- "Till the 10th degree he is in the ascendent and reaches the highest point in the 10th degree. From the 11th..."
- `strijataka-1931:8.15.3`: harm to husband (poisonous girl) -- "If she is born in Chitta on any lunar day excepting the 14th day of the dark half of the month, she will be..."
- `strijataka-1931:8.20.2`: widowhood -- "[Moola —] widowhood"
- `strijataka-1931:10.8.2`: husband's death -- "[Guru in 8 —] loss of husband,"
- `strijataka-1931:10.31.1`: widowhood -- "Sani in 7 — widowhood"
- `strijataka-1931:11.9.4`: speaks of death -- "Swarga is inhabited by Devatas, headed by Indra. Martya is inhabited by human beings who are subjected to M..."
- `strijataka-1931:12.11.1`: widowhood -- "If the lords of 7 and 8 join and occupy the 8th, aspected by evil planets there will be widowhood"
- `strijataka-1931:12.12.1`: widowhood -- "If Rahu joins the 7th, if the lord of 7th has conjunction with Ravi and has the aspect of the lord of the 8..."
- `strijataka-1931:12.13.1`: widowhood -- "If the lord of 7 combines with Sani, is aspected by Kuja, Chandra and Rahu are in the 8th, there will be wi..."
- `strijataka-1931:12.14.1`: widowhood -- "If Kuja is in 8 in combination with the lord of 8th, and Lagna falls in an evil Navamsa, widowhood will bef..."
- `strijataka-1931:12.15.1`: listed as a combination for widowhood -- "If Rahu combines with Sani and Kuja and joins 7th or 8th"
- `strijataka-1931:12.16.1`: husband's death and killing of husband, violence -- "romantic, interesting and instructive A poor girl, marries a poor man and he dies and she lives to a long t..."

### Caste and birth status (25)

- `brihat-jataka-1885:14.2.5`: Low social birth; sexual immorality of mother. -- "[If the double planets occupying together a sign of the Zodiac at the time of birth be] the Moon and Saturn..."
- `brihat-jataka-1885:14.4.50`: Deformity; low birth. -- "[Again, if the Yoga planets occupying a single sign be] (27). Mars, Mercury and Venus—will be of defective..."
- `brihat-jataka-1885:14.4.117`: Low birth; disease. -- "[Lastly, if the yoga planets occupying a single sign of Zodiac at the time of birth be the several planets]..."
- `brihat-jataka-1885:15.1.2`: mentions caste (a Brahman ascetic), in a note no reading quotes -- "(c). The ascetic life of the most powerful planet will be embraced by the person first, then that of the pl..."
- `brihat-jataka-1885:17.10.7`: Mention of caste -- "[A person born with the Moon in sign Capricorn] and will be attached to old women of low caste;"
- `brihat-jataka-1885:18.11.4`: mentions caste -- "[A person born with Mercury in sign Pisces] and will be learned in the handicraft of men of low castes."
- `brihat-jataka-1885:18.18.1`: mentions caste -- "A person born with Saturn in sign Taurus will be fond of women of low caste,"
- `brihat-jataka-1885:18.20.6`: mentions caste; spouse's disability -- "[A person born when Aries is the rising sign] will marry either a woman of low caste or a deceitful woman o..."
- `brihat-jataka-1885:18.20.55`: mentions caste -- "[A person born when the rising sign is Sagittari] will serve under men of low caste,"
- `brihat-jataka-1885:18.20.64`: mentions caste -- "[A person born when the rising sign is Capricorn] will have a wife of low caste, and will be attached to her,"
- `brihat-jataka-1885:21.7.9`: low social station -- "[the rising Navamsa] when it is that of Sagitari he will become a slave ;"
- `brihat-jataka-1885:24.5.10`: mentions low caste -- "[When the rising sign or the sign occupied by the Moon at the time of birth of a woman is Leo, if the risin..."
- `brihat-jataka-1885:24.5.17`: mentions low caste -- "[When the rising sign or the sign occupied by the Moon at the time of birth of a woman is either Capricorn..."
- `brihat-samhita-1884:68.3.4`: crime, violence and caste -- "if the soles be of the color of burnt clay, he will murder a Brahmin ;"
- `brihat-samhita-1884:68.3.5`: relations with women under prohibition -- "[the feet] and if the color be yellow, he will have sexual intercourse with women under prohibition."
- `brihat-samhita-1884:68.25.1`: relations with women under prohibition -- "If the folds be not straight, the person will be wicked and will have sexual intercourse with women under p..."
- `brihat-samhita-1884:68.40.3`: relations with women under prohibition -- "[the palms] if yellow, he will cohabit with women under prohibition ;"
- `brihat-samhita-1884:68.61.1`: relations with women under prohibition -- "If the nose appear as if cut, the person will cohabit with women under prohibition;"
- `brihat-samhita-1884:68.69.3`: relations with women under prohibition -- "[the brows] and if they be bent in the middle, he will cohabit with women under prohibition."
- `brihat-samhita-1884:68.76.1`: relations with women under prohibition -- "If the lines be broken, the person will cohabit with a woman under prohibition ;"
- `strijataka-1931:6.6.1`: speaks of birth status (born of adultery) -- "If Sani and Chandra occupy a movable sign aspected by Sukra, her husband will be fond of other women, fickl..."
- `strijataka-1931:6.6.2`: speaks of birth status (illegitimacy) -- "This means that his mother is immoral and he is not the son of his reputed or registered father."
- `strijataka-1931:7.20.1`: mention of caste (her class) -- "5. Chandra in Simha, leader among her class"
- `strijataka-1931:11.1.2`: mentions caste -- "[If Guru is in Lagna, if Chandra is in 7th or in his own vergas, and Sukra is in 10th, the woman will becom..."
- `strijataka-1931:11.1.3`: mentions caste -- "Here it means that although a girl may be born in humble circumstances and belong to a lower caste than tha..."

### Harm to a parent, partner or child (5)

- `brihat-jataka-1885:14.2.1`: Trade in women; harm to mother. -- "If the double planets occupying together a sign of the Zodiac at the time of birth be the Moon and Mars the..."
- `brihat-jataka-1885:14.4.13`: Harm to a parent. -- "(11). Moon and Saturn, he will possess a bad wife, will ill-treat his father and will be poor."
- `brihat-jataka-1885:18.20.12`: harm to parents -- "[A person born when Taurus is the rising sign] will ill-treat his parents,"
- `strijataka-1931:6.4.4`: harm to the husband's family -- "[If Lagna or Chandra is between powerful evil planets] and she will cause extinction of her father-in-law's..."
- `strijataka-1931:11.9.5`: physical ruin (harm to health) -- "Royal power is no doubt very covetable and desirable when people have got steady heads and pure minds. They..."

### Crime, violence and imprisonment (33)

- `brihat-jataka-1885:10.3.5`: violence (acts of torture) -- "[if the lord be Saturn, the person will acquire wealth] by acts of torture, (f)"
- `brihat-jataka-1885:11.20.2`: crime (chief of robbers) -- "Again, when powerful benefic signs form the Kendras and malefic planets occupy malefic signs, a person born..."
- `brihat-jataka-1885:12.15.2`: Predicts violence (torture). -- "A person born under a Bana (Ishu) yoga will indulge in torture, will be a jailor and will make arrows."
- `brihat-jataka-1885:12.18.4`: Predicts injury and violence (receiving blows, torture). -- "A person born under a Sula yoga will be bold in fight, will receive blows and will be fond of money (a) but..."
- `brihat-jataka-1885:13.7.1`: Predicts fondness for fighting (violence). -- "If the yoga planet be Mars, the person will be active, fond of fight and wealthy, and will engage in deeds..."
- `brihat-jataka-1885:14.3.3`: speaks of duels (violence) -- "[If the double planets occupying together a sign of the Zodiac at the time of birth be] Mars and Venus, the..."
- `brihat-jataka-1885:14.4.24`: Violence. -- "II.—OF THREE PLANETS. Again, if the Yoga planets occupying a single sign be (1). The Sun, the Moon and Mars..."
- `brihat-jataka-1885:14.4.70`: Sexual immorality; theft. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (12). The Sun, Mar..."
- `brihat-jataka-1885:14.4.112`: Theft. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (19). The Moon, Ma..."
- `brihat-jataka-1885:14.4.114`: Torture, imprisonment and disease. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (21). Mars, Mercur..."
- `brihat-jataka-1885:14.4.116`: Theft; sexual immorality. -- "[Lastly, if the yoga planets occupying a single sign of Zodiac at the time of birth be the several planets]..."
- `brihat-jataka-1885:18.5.2`: injury; crime -- "[A person born with Mars in sign Aries or Scorpio] will have a body marked with wounds, will be a thief"
- `brihat-jataka-1885:18.8.2`: crime -- "[A person born with Mercury in sign Aries or Scorpio] will be a thief,"
- `brihat-jataka-1885:18.17.2`: imprisonment; violence -- "A person born with Saturn in sign Scorpio will suffer imprisonment, will receive blows,"
- `brihat-jataka-1885:18.20.56`: crime (theft) -- "[A person born when the rising sign is Sagittari] will be deprived of his property by thieves, by fire or b..."
- `brihat-jataka-1885:18.20.61`: imprisonment -- "[A person born when the rising sign is Capricorn] will suffer imprisonment,"
- `brihat-jataka-1885:19.1.5`: crime (theft) -- "[If at the time of birth, the Moon occupy sign Aries] if by the Saturn, he will be a thief"
- `brihat-jataka-1885:19.1.8`: crime (theft) -- "[If at the time of birth, the Moon occupy sign Taurus] if she be aspected by Mercury, he will be a thief;"
- `brihat-jataka-1885:19.5.2`: violence -- "[If at the time of birth the Moon occupy the Navamsa of Mars] if aspected by Mars, he will be fond of torture;"
- `brihat-jataka-1885:19.6.2`: crime (theft) -- "[If at the time of birth, the Moon occupy the Navamsa of Mercury] if aspected by Mars he will be a thief;"
- `brihat-jataka-1885:20.4.5`: violence (cruelty to animals) -- "If she occupy the third house, he will delight in torturing animals."
- `brihat-jataka-1885:21.2.7`: imprisonment -- "[occupy their inimical or depression signs] If five planets do so the person will suffer imprisonment;"
- `brihat-jataka-1885:21.2.9`: violence -- "[occupy their inimical or depression signs] and if seven planets do so, he will subject to torture persons..."
- `brihat-jataka-1885:21.6.4`: violence -- "if she occupy an Ayudha (weapon) Drekkana (d) the person will do deeds of torture ;"
- `brihat-jataka-1885:21.7.1`: crime -- "A person born when the rising Navamsa (a) is that of Aries will be a thief ;"
- `brihat-jataka-1885:21.7.13`: crime (chief of thieves) -- "But if the rising Navamsa be at the same time a Vargottama Navamsa (b) the person born will be the chief of..."
- `brihat-jataka-1885:21.10.7`: violence -- "[the Trimsamsa of Saturn] and when it is occupied by the Moon, he will indulge in acts of torture."
- `brihat-jataka-1885:22.3.2`: Predicts violence (blows) to the traveller. -- "The effects of the Karaka planets are described in Varaha Mihira's work on Yoga Yatra in which it is stated..."
- `brihat-samhita-1884:68.57.2`: crime -- "[the hair about the face] and if it be red, not glossy and small in quantity, the person will be a thief."
- `brihat-samhita-1884:68.61.3`: crime -- "[the nose] if bent, he will be a thief;"
- `brihat-samhita-1884:68.65.1`: crime -- "If the eyes be like those of the deer or round or squint, the person will be a thief ;"
- `brihat-samhita-1884:70.21.3`: predicts crime (theft) -- "[If the teeth be large, uneven and of disagreeable appearance, if the gum be black, she will suffer miserie..."
- `strijataka-1931:10.32.2`: crime -- "[Sani in 8 —] thievish habits"

### Illness, injury, disability and deformity (108)

- `brihat-jataka-1885:12.11.3`: Predicts bodily defect (defective organs). -- "and a person born under a Nala yoga will be of defective organs, settled views, rich and skilled in work."
- `brihat-jataka-1885:12.13.2`: Predicts disease. -- "a person born under a Sakata yoga will live by means of carts, will be afflicted with diseases, and will ha..."
- `brihat-jataka-1885:14.4.31`: Disease. -- "[Again, if the Yoga planets occupying a single sign be] (8). The Sun, Mars and Venus, he will be afflicted..."
- `brihat-jataka-1885:14.4.32`: Disability and disease. -- "[Again, if the Yoga planets occupying a single sign be] (9). The Sun, Mars and Saturn, he will be separated..."
- `brihat-jataka-1885:14.4.36`: Disease. -- "[Again, if the Yoga planets occupying a single sign be] (13). The Sun, Jupiter and Venus, he will possess a..."
- `brihat-jataka-1885:14.4.51`: Disease. -- "[Again, if the Yoga planets occupying a single sign be] (28). Mars, Mercury and Saturn—will serve under oth..."
- `brihat-jataka-1885:14.4.59`: Disease. -- "III.—OF FOUR PLANETS. Again, if the yoga planets occupying together a sign of Zodiac at the time of birth b..."
- `brihat-jataka-1885:14.4.62`: Disease; sexual immorality. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (4). The Sun, Moon..."
- `brihat-jataka-1885:14.4.64`: Deformity. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (6). The Sun, Moon..."
- `brihat-jataka-1885:14.4.66`: Sexual immorality; disease. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (8). The Sun, Moon..."
- `brihat-jataka-1885:14.4.68`: Deformity. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (10). The Sun, Moo..."
- `brihat-jataka-1885:14.4.69`: Disease. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (11). The Sun, Mar..."
- `brihat-jataka-1885:14.4.73`: Disability (blindness). -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (15). The Sun, Mar..."
- `brihat-jataka-1885:14.4.80`: Deformity. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (22). The Moon, Ma..."
- `brihat-jataka-1885:14.4.90`: Disease. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (32). Mars, Mercur..."
- `brihat-jataka-1885:14.4.91`: Deformity. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (33). Mars, Mercur..."
- `brihat-jataka-1885:14.4.97`: Disability (defective eyes). -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (4). The Sun, Moon..."
- `brihat-jataka-1885:14.4.102`: Disease. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (9). The Sun, Moon..."
- `brihat-jataka-1885:14.4.106`: Disease. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (13). The Sun, Mar..."
- `brihat-jataka-1885:14.4.107`: Disability (blindness). -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (14). The Sun, Mar..."
- `brihat-jataka-1885:14.4.113`: Deformity. -- "[Again, if the yoga planets occupying together a sign of Zodiac at the time of birth be] (20). The Moon, Me..."
- `brihat-jataka-1885:14.4.119`: Disease and madness. -- "[Lastly, if the yoga planets occupying a single sign of Zodiac at the time of birth be the several planets]..."
- `brihat-jataka-1885:17.1.4`: Injury and deformity -- "[A person born with the Moon in sign Aries] will have disfigured nails and a wounded head;"
- `brihat-jataka-1885:17.2.3`: Bodily deformity -- "[A person born with the Moon in sign Taurus] will have a large hump on the neck;"
- `brihat-jataka-1885:17.2.5`: Disease -- "[A person born with the Moon in sign Taurus] will suffer from phlegmatic affections,"
- `brihat-jataka-1885:17.4.1`: Bodily deformity -- "A person born with the Moon in sign Cancer will possess a bent body;"
- `brihat-jataka-1885:17.5.4`: Disease and bodily ailments -- "[A person born with the Moon in sign Leo] will be afflicted with pains caused by hunger, thirst, belly-ache..."
- `brihat-jataka-1885:17.7.4`: Bodily deformity -- "[A person born with the Moon in sign Libra] will be of thin and defective limbs and fond of travels;"
- `brihat-jataka-1885:17.7.7`: Disease -- "[A person born with the Moon in sign Libra] will be sickly;"
- `brihat-jataka-1885:17.8.3`: Disease -- "[A person born with the Moon in sign Scorpio] will be afflicted with diseases when young;"
- `brihat-jataka-1885:17.9.6`: Bodily deformity -- "[A person born with the Moon in sign Sagittarius] will have indistinct shoulders, disfigured nails and larg..."
- `brihat-jataka-1885:17.11.2`: Disability -- "[A person born with the Moon in sign Aquarius] will be deaf;"
- `brihat-jataka-1885:18.6.3`: deformity -- "[A person born with Mars in sign Cancer] will be of defective limbs and will be wicked."
- `brihat-jataka-1885:18.18.5`: physical defect -- "[A person born with Saturn in sign Cancer] will have very few teeth,"
- `brihat-jataka-1885:18.19.4`: physical weakness or disability -- "[A person born with Saturn in sign Capricorn or Aquarius] will have weak eyes,"
- `brihat-jataka-1885:18.20.2`: deformity -- "1. A person born when Aries is the rising sign will have disfigured fingers,"
- `brihat-jataka-1885:18.20.16`: deformity -- "3. A person born when the rising sign is Gemini will be either of defective limbs or will possess extra limbs,"
- `brihat-jataka-1885:18.20.23`: disease -- "[A person born when the rising sign is Cancer] will suffer diseases of genital organs,"
- `brihat-jataka-1885:18.20.27`: speech defect -- "[A person born when the rising sign is Cancer] will be of imperfect speech,"
- `brihat-jataka-1885:18.20.36`: injury -- "[A person born when the rising sign is Virgo] will receive wounds,"
- `brihat-jataka-1885:18.20.53`: physical defect -- "[A person born when the rising sign is Sagittari] will be of defective nails,"
- `brihat-jataka-1885:18.20.72`: disfigurement -- "[A person born when the rising sign is Pisces] will be of disfigured skins and of active habits,"
- `brihat-jataka-1885:19.1.24`: disease -- "[If at the time of birth, the Moon occupy sign Cancer] and if by the Sun, he will suffer from diseases of t..."
- `brihat-jataka-1885:19.2.18`: disability or deformity -- "[If at the time of birth, the Moon occupy sign Scorpio] if by Saturn, he will be of defective limbs;"
- `brihat-jataka-1885:20.1.2`: disability (blindness) -- "[If at the time of birth of a person, the Sun occupy the ascendant, the person will be] without sight"
- `brihat-jataka-1885:20.1.5`: disease (eye diseases) -- "[but if Aries be the rising sign and the Sun occupy it the person will be] and afflicted with diseases of t..."
- `brihat-jataka-1885:20.1.6`: disability (night blindness) -- "if Leo be the rising sign and the Sun occupy it, he will be blind at night;"
- `brihat-jataka-1885:20.1.7`: disability (blindness) -- "if Libra be the rising sign and the sun occupy it, the person will be blind"
- `brihat-jataka-1885:20.1.9`: eye ailment -- "if Cancer be the rising sign and the Sun occupy it, he will have a mote in his eye."
- `brihat-jataka-1885:20.1.11`: disease (face) -- "[If the Sun occupy the 2nd house from the ascendant, the person] and will suffer from diseases in the face."
- `brihat-jataka-1885:20.3.3`: disability (blindness) -- "[if he occupy the 8th house, the person] and will become blind;"
- `brihat-jataka-1885:20.3.9`: disease -- "[Accordingly Satyachariar says that such a person] will be afflicted with diseases"
- `brihat-jataka-1885:20.4.1`: disability -- "If at the time of birth of a person the Moon occupy the ascendant such person will become dumb or mad or an..."
- `brihat-jataka-1885:20.5.3`: disease -- "[If she occupy the 8th house, the person] and will be afflicted with diseases."
- `brihat-jataka-1885:20.5.8`: deformity -- "[and if she occupy the 12th house from the ascendant, the person will be] and of defective limbs."
- `brihat-jataka-1885:20.6.1`: injury -- "If at the time of birth of a person Mars occupy the ascendant, such person will possess a wounded body;"
- `brihat-jataka-1885:20.9.2`: disease -- "[If at the time of birth of a person Saturn occupy the ascendant, such person] will be afflicted with disea..."
- `brihat-jataka-1885:21.2.6`: disease -- "[occupy their inimical or depression signs] If four planets do so, the person will become afflicted with di..."
- `brihat-jataka-1885:21.7.6`: bodily deformity -- "[the rising Navamsa] when it is that of Virgo, he will be hermaphrodite ;"
- `brihat-jataka-1885:21.8.3`: disease -- "A person born when Saturn occupies his own Trimsamsa will be afflicted with diseases ;"
- `brihat-jataka-1885:24.10.2`: disease -- "if the setting Navamsa be that of Mars and if the setting sign be aspected by Saturn, the woman will posses..."
- `brihat-samhita-1884:68.17.3`: disease -- "[the rump] if it be half the average size, he will be sickly ;"
- `brihat-samhita-1884:68.22.1`: disease -- "If the navel be in the middle of a fold of the skin or if it be depressed, the person will suffer from bell..."
- `brihat-samhita-1884:68.38.2`: injury -- "[If the wrists be invisible, firm and close,] if otherwise and if the joints be loose, the hands will suffe..."
- `brihat-samhita-1884:68.50.2`: injury -- "If the lines be broken, the person will fall from a tree ;"
- `brihat-samhita-1884:68.66.3`: disability -- "and if the eyes be exceedingly black, the person will become blind."
- `brihat-samhita-1884:68.74.4`: mental illness -- "[the laughter] and if it be repeated at the end, he will become mad."
- `brihat-samhita-1884:68.111.1`: bodily deformity -- "A person of the nature of Akas will be able, open-mouthed, skilled in a knowledge of sound and with holes i..."
- `strijataka-1931:5.2.7`: predicts a medical disorder of the husband -- "If the 7th from Lagna or Chandra is occupied by Sani or Budha the husband will become impotent soon after m..."
- `strijataka-1931:6.10.1`: miscarriage -- "occupies the 7th and has the aspect of Sani she will have abortions."
- `strijataka-1931:6.10.2`: illness of children -- "If Sani occupies the 7th possessing the aspect of Kuja, the issues will be sickly."
- `strijataka-1931:7.4.2`: disease (windy and phlegmatic complaints) -- "[One who is born in Mithuna,] windy and phlegmatic complaints"
- `strijataka-1931:7.8.2`: disease (heartburn) -- "[One who is born in Thula] heartburn"
- `strijataka-1931:7.12.2`: disease (blood disease) -- "[One who is born in Kumbha] blood disease"
- `strijataka-1931:7.19.1`: ill health (sickly) -- "4. Chandra in Kataka, sickly"
- `strijataka-1931:7.25.1`: deformity (terrible teeth) -- "10. Chandra in Makara, terrible teeth"
- `strijataka-1931:8.4.4`: disease: phlegmatic complaints -- "[Krithika —] phlegmatic"
- `strijataka-1931:8.7.2`: disease: bilious and phlegmatic complaints -- "[Aridra —] bilious and phlegmatic"
- `strijataka-1931:8.20.4`: disease -- "[Moola —] sickness"
- `strijataka-1931:9.3.1`: disease -- "Ravi in 1 — Ravi in Lagna produces hot body, heat diseases,"
- `strijataka-1931:9.4.3`: ill health -- "[Ravi in 2 —] debility,"
- `strijataka-1931:9.6.2`: illness -- "[Ravi in 4 —] sickly body,"
- `strijataka-1931:9.8.1`: disability -- "Ravi in 6 — impotence,"
- `strijataka-1931:9.9.3`: disease -- "[Ravi in 7 —] phlegmatic diseases,"
- `strijataka-1931:9.9.5`: deformity -- "[Ravi in 7 —] and deformed body."
- `strijataka-1931:9.10.3`: menstrual disorder -- "[Ravi in 8 —] suffering from excessive blood passing."
- `strijataka-1931:9.15.2`: illness -- "[Chandra in 1 —] when the moon is on the wane, slender body, sickness,"
- `strijataka-1931:9.17.1`: disease -- "Chandra in 3 — diseases from excessive phlegm and wind,"
- `strijataka-1931:9.20.2`: injury and disease -- "[Chandra in 6 —] wounds, various kinds of diseases, emaciated body."
- `strijataka-1931:9.22.2`: bodily deformity -- "[Chandra in 8 —] ill-developed breasts and sexual organ,"
- `strijataka-1931:9.26.2`: disease -- "[Chandra in 12 —] windy diseases,"
- `strijataka-1931:9.28.6`: disease -- "[Kuja in 2 —] many diseases,"
- `strijataka-1931:9.29.3`: disability -- "[Kuja in 3 —] impotence,"
- `strijataka-1931:9.30.2`: injury -- "cuts and scars,"
- `strijataka-1931:9.31.2`: illness -- "[Kuja in 9 —] sickness,"
- `strijataka-1931:9.34.4`: illness -- "[Kuja in 12 —] always suffering from some complaint and weak constitution."
- `strijataka-1931:9.42.2`: illness -- "[Budha in 8 —] always sickness,"
- `strijataka-1931:10.3.2`: disease -- "[Guru in 3 —] and suffering always from some disease or nervous complaints in the limbs"
- `strijataka-1931:10.8.3`: disease -- "[Guru in 8 —] pains in hands and feet,"
- `strijataka-1931:10.8.5`: disease -- "[Guru in 8 —] and many complaints in the body"
- `strijataka-1931:10.12.2`: disease -- "[Guru in 12 —] sickly body,"
- `strijataka-1931:10.24.3`: disease -- "[Sukra in 12 —] disease"
- `strijataka-1931:10.25.1`: deformity -- "Sani in 1 — ugly and deformed body"
- `strijataka-1931:10.25.4`: disease -- "[Sani in 1 —] windy complaints constipation and piles"
- `strijataka-1931:10.31.3`: disease -- "[Sani in 7 —] many diseases"
- `strijataka-1931:10.32.4`: injury -- "[Sani in 8 —] early dangers and accidents"
- `strijataka-1931:10.36.1`: disease -- "Sani in 12 — bloody complaints, excess of wind and phlegm, diseases from these sources,"
- `strijataka-1931:11.24.1`: mentions disease -- "much better. Such is the constitution of human society. These Rajayogas give power, money and luxuries affo..."

<!-- hidden-report:end -->
