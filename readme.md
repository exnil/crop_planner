# Stardew Valley Crop Planner

A tool for planning crop schedules in the Stardew Valley game.

####**<a href="http://exnil.github.io/crop_planner/">Live version on github.io</a>**

<a href="https://www.reddit.com/r/StardewValley/comments/4ahfu4/crop_planner/" target="_blank">Reddit thread</a>

---

### Crop Info
Crop info is stored in config.json. This data is retrieved from game files in *[install dir]/Content/Data/*, specifically Crops.xnb and ObjectInformation.xnb. I use <a href="https://github.com/Draivin/XNBNode" target="_blank">XNBNode by Draivin</a> to decompress these files and parse them with a Python script to save into the config.json file.

---

### Item Prices
All items have a **base price** which the game uses to calculate the sell price (when you ship items) and buy price (when you buy items from stores) of that item. Buy price is simply <code>Base Price * 2</code>.

The calculation for sell price of an item (without added Profession bonuses) is below. The Quality of an item is used numerically as a multiplier: 0 for regular; 1 for silver; 2 for gold.
<pre>
(int) Sell Price = Base Price * (1 + (Quality * 0.25))
</pre>

*Note: some items have sell/buy prices that deviate from the above formulas. These prices are likely hard-coded into the game.*

---

### Profit-per-day
Crop profits-per-day are calculated using the <b><i>minimum sell price</i></b> of a crop.<br>
Profit per day: <code>((Total Yields * Sells For) - (Seed Price * Total Plantings)) / (Final Harvest Date - 1)</code>

<b>Example 1 - Parsnip</b><br>
Parsnips take 4 days to grow after the day they are planted. In Spring, they can be planted 6 times and yield a total of 6 Parsnips, assuming replanting occurs on the same day of harvesting. The last harvest occurs on Day 25. Seeds cost 20g, and Parsnips sell for a minimum of 35g.
<pre>
((6 * 35g) - (20g * 6)) / (25 - 1)
90g / 24
<b>= 3.75g/day</b>
</pre>


<b>Example 2 - Corn</b><br>
Corn takes 14 days to grow after the day it is planted. In Spring and Fall, it is planted once and can yield a total of 11 Corn. The last harvest occurs on Day 55. Seeds cost 150g, and Corn sells for a minimum of 50g.
<pre>
((11 * 50g) - (150g * 1)) / (55 - 1)
400g / 54
<b>= 7.4g/day</b>
</pre>

---

<i>All copyrighted content (images, textures, etc.) belong to their respective owners (ConcernedApe / Stardew Valley) and are not included under the MIT license of this project.</i>
