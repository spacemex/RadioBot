document.getElementById('searchButton').addEventListener('click', async () => {
    const query = document.getElementById('searchQuery').value;
    console.log(`Search query: ${query}`);

    if (!query) {
        alert("Please enter a search query.");
        return;
    }

    try {
        const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Network response was not ok");

        const stations = await response.json();
        const stationList = document.getElementById('stationList');
        stationList.innerHTML = '';

        // Sort stations alphabetically by name
        stations.sort((a, b) => a.name.localeCompare(b.name));

        if (stations.length === 0) {
            stationList.innerHTML = '<li>No results found</li>';
        } else {
            stations.forEach(station => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>${station.name}</strong>
                    <br>Genre: ${station.tags}
                    <br>Country Code: ${station.countrycode}
                    <br>Stream URL: <a href="${station.url}" target="_blank">${station.url}</a>
                `;
                listItem.style.cursor = 'pointer';

                // Click event to copy the station name and URL to the clipboard
                listItem.addEventListener('click', () => {
                    const textToCopy = `Station: ${station.name}\nStream URL: ${station.url}`;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        alert(`Copied: ${station.name} and its URL`);
                    }).catch(err => {
                        console.error('Could not copy to clipboard', err);
                    });
                });

                stationList.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('Error fetching stations:', error);
        alert('There was an error fetching the stations. Please try again later.');
    }
});