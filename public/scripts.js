function updateCurrentChannel() {

    // AJAX request to fetch the current channel from the server
    $.get('/current-channel', function(data) {

        // Update the currentChannel element on the webpage with the received data
        $('#currentChannel').text(data);
    });
}

// Wait that DOM is fully loaded before updating
$(document).ready(function() {
    updateCurrentChannel();
});

document.addEventListener('DOMContentLoaded', () => {
    const viewersElement = document.getElementById('viewers');
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        viewersElement.textContent = data.viewers;
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
    };
});

function makeVis() {
    info.style.display = "block";
}
function makeHid() {
    info.style.display = "none";
}