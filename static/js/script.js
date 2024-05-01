function normalizeUrl(url) {
    let urlObj = new URL(url);
    urlObj.search = '';  // Remove a query string
    return urlObj.toString();
}

function toggleSelection(element) {
    var imagePath = normalizeUrl(element.getAttribute('data-image-path'));
    var checkmark = element.querySelector('.checkmark');
    var imgContainer = element.querySelector('.img_container'); // Acessa o contêiner da imagem

    if (localStorage.getItem(imagePath) === 'selected') {
        localStorage.removeItem(imagePath);
        checkmark.style.display = 'none';
        imgContainer.classList.remove('selected'); // Remove a classe selected
    } else {
        localStorage.setItem(imagePath, 'selected');
        checkmark.style.display = 'block';
        imgContainer.classList.add('selected'); // Adiciona a classe selected
    }
    updateImageCount();
}


window.onload = function () {
    document.querySelectorAll('.container_item').forEach(item => {
        const imagePath = normalizeUrl(item.getAttribute('data-image-path'));
        const checkmark = item.querySelector('.checkmark');
        const imgContainer = item.querySelector('.img_container'); // Acessa o contêiner da imagem
        
        if (localStorage.getItem(imagePath) === 'selected') {
            checkmark.style.display = 'block';
            imgContainer.classList.add('selected'); // Adiciona a classe selected
        } else {
            checkmark.style.display = 'none';
            imgContainer.classList.remove('selected'); // Remove a classe selected
        }
    });
    updateCheckmarks();  // Atualiza todos os checkmarks após a remoção
    updateImageCount();
};

function updateCheckmarks() {
    document.querySelectorAll('.container_item').forEach(item => {
        const imagePath = normalizeUrl(item.getAttribute('data-image-path'));
        const checkmark = item.querySelector('.checkmark');
        if (localStorage.getItem(imagePath) === 'selected') {
            checkmark.style.display = 'block';
        } else {
            checkmark.style.display = 'none';
        }
    });
}




function saveSelection(name) {
    fetch('/save-selection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageName: name })
    })
        .then(response => response.json())
        .then(data => console.log('Success:', data))
        .catch((error) => console.error('Error:', error));
}

function removeSelection(name) {
    fetch('/remove-selection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageName: name })
    })
        .then(response => response.json())
        .then(data => console.log('Removed:', data))
        .catch((error) => console.error('Error:', error));
}



// -----------------------------------------------------------------------------------------


function openCartModal() {
    // Usa o método do Bootstrap para mostrar o modal
    $('#cartModal').modal('show');

    // Carregar imagens selecionadas no modal
    updateCartDisplay();
}

function updateCartDisplay() {
    var container = document.getElementById('selectedImagesContainer');
    container.innerHTML = '';  // Limpa o contêiner existente

    let selectedImages = [];

    // Itera sobre todos os itens salvos no LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            selectedImages.push({
                id: imagePath,
                name: imagePath.split('/').pop()  // Assume que o nome do arquivo é a última parte do caminho
            });
        }
    }
    updateTotalValue();
    updateImageCount();

    if (selectedImages.length > 0) {
        const carouselContainer = document.createElement('div');
        carouselContainer.className = 'carousel-container';

        selectedImages.forEach((imageObj) => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'image-wrapper';

            const imgElement = document.createElement('img');
            imgElement.src = imageObj.id;  // Usa o id como src pois id contém o caminho completo
            imgElement.alt = imageObj.name;
            imgElement.className = 'carousel-image';

            // // Cria um parágrafo para exibir o nome da imagem
            // const nameParagraph = document.createElement('p');
            // nameParagraph.textContent = imageObj.name;
            // nameParagraph.className = 'image-name';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image-btn';

            // Cria um elemento <span> para conter o X
            const spanElement = document.createElement('span');
            spanElement.textContent = 'X';
            spanElement.className = 'span_remove';

            removeBtn.onclick = function () {
                removeFromCart(imageObj.id, imgContainer);  // Define a ação para remover da seleção
            };

            removeBtn.appendChild(spanElement);

            imgContainer.appendChild(imgElement);
            // imgContainer.appendChild(nameParagraph);
            imgContainer.appendChild(removeBtn);

            carouselContainer.appendChild(imgContainer);
        });

        container.appendChild(carouselContainer);
    }
}

function removeFromCart(imagePath, imgContainer) {
    localStorage.removeItem(imagePath);
    imgContainer.remove();  // Remove o contêiner da imagem do DOM
    updateCheckmarks();  // Atualiza todos os checkmarks após a remoção
    updateTotalValue();
    updateImageCount();
}


// -------------------------------------------------------------------------------------------------


function updateTotalValue() {
    let count = 0;
    // Conta quantas imagens estão selecionadas
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            count++;
        }
    }

    // Determina o preço por imagem com base na quantidade selecionada
    let pricePerImage = 20.00; // Preço padrão
    if (count >= 10 && count < 20) {
        pricePerImage = 17.50;
    } else if (count >= 20) {
        pricePerImage = 15.00;
    }

    // Calcula o valor total
    let totalValue = count * pricePerImage;

    // Atualiza o campo de valor total no HTML
    document.getElementById('totalValue').value = `R$ ${totalValue.toFixed(2)}`;
}


function updateImageCount() {
    let count = 0;
    // Itera sobre todos os itens salvos no LocalStorage para contar quantos estão selecionados
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            count++;
        }
    }

    // Atualiza todos os contadores no site
    const cartCounters = document.querySelectorAll('.cart-counter');
    cartCounters.forEach(counter => {
        counter.textContent = count;
    });
}


// ---------------------------------------------------------------------------------------------------
function getCurrentSubfolder() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.trim() !== '');
    // Considerando que o nome do evento é sempre o primeiro segmento após "eventos",
    // e a subpasta de interesse é o segundo segmento após "eventos".
    if (segments.length > 1 && segments[0] === "eventos") {
        return decodeURIComponent(segments[1]);  // Retorna o nome da subpasta decodificado
    }
    return '';  // Retorna vazio se não for encontrado
}




function sendToWhatsApp() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const totalValue = document.getElementById('totalValue').value;
    const currentFolderName = document.getElementById('currentFolderName').value; // Supõe que o nome da pasta atual está armazenado aqui
    const event_folder_name = getCurrentSubfolder();

    let imageNames = [];
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            const imageName = decodeURIComponent(imagePath.split('/').pop());
            imageNames.push(imageName);
        }
    }

    let
        message = `*Resumod o Pedido* \n\n`;
    message += `*Evento*: ${event_folder_name}\n\n`;
    message += `*Nome*: ${name}\n\n*Telefone*: ${phone}\n\n*Email*: ${email}\n\n`;
    message += `*Imagens Selecionadas:*\n ${imageNames.join(',\n ')}\n\n`;
    message += `*Total do Pedido:* ${totalValue}`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/5511986879746?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');

    setTimeout(() => {
        console.log('Attempting to clear LocalStorage...');
        localStorage.clear();
        console.log('LocalStorage should now be cleared.');

        updateCheckmarks();
        updateTotalValue();
        updateImageCount();
        removeFromCart(imageObj.id, imgContainer);
    }, 300000); // 300000 milissegundos = 5 minutos


}

// ----------------------------------------------------------------------------------------


