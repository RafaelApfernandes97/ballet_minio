function normalizeUrl(url) {
    let urlObj = new URL(url);
    urlObj.search = '';  // Remove a query string
    return urlObj.toString();
}

function toggleSelection(element, key, name) {
    var imagePath = normalizeUrl(element.getAttribute('data-image-path'));
    var checkmark = element.querySelector('.checkmark');
    var checkbox = element.querySelector('.select-checkbox'); // Acessa a checkbox

    if (localStorage.getItem(imagePath) === 'selected') {
        localStorage.removeItem(imagePath);
        checkmark.style.display = 'none';
        checkbox.checked = false; // Desmarca a checkbox
        element.classList.remove('selected'); // Remove a classe selected do próprio elemento
    } else {
        localStorage.setItem(imagePath, 'selected');
        checkmark.style.display = 'block';
        checkbox.checked = true; // Marca a checkbox
        element.classList.add('selected'); // Adiciona a classe selected ao próprio elemento
    }
    updateCheckmarks();  // Atualiza todos os checkmarks após a remoção
    updateImageCount();
    updateTotalValue();  // Atualiza o valor total ao carregar a página
    updateCartDisplay(); // Atualiza o carrinho ao carregar a página
}

window.onload = function () {
    document.querySelectorAll('.container_item').forEach(item => {
        const imagePath = normalizeUrl(item.getAttribute('data-image-path'));
        const checkmark = item.querySelector('.checkmark');
        const imgContainer = item.querySelector('.img_container'); // Acessa o contêiner da imagem, se existir

        if (localStorage.getItem(imagePath) === 'selected') {
            checkmark.style.display = 'block';
            if (imgContainer) {
                imgContainer.classList.add('selected'); // Adiciona a classe selected se imgContainer existir
            } else {
                item.classList.add('selected'); // Adiciona a classe selected ao próprio item
            }
        } else {
            checkmark.style.display = 'none';
            if (imgContainer) {
                imgContainer.classList.remove('selected'); // Remove a classe selected se imgContainer existir
            } else {
                item.classList.remove('selected'); // Remove a classe selected do próprio item
            }
        }
    });
    updateCheckmarks();  // Atualiza todos os checkmarks após a remoção
    updateImageCount();
    updateTotalValue();  // Atualiza o valor total ao carregar a página
    updateCartDisplay(); // Atualiza o carrinho ao carregar a página
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

function openCartModal() {
    // Usa o método do Bootstrap para mostrar o modal
    $('#cartModal').modal('show');

    // Carregar imagens selecionadas no modal
    updateCartDisplay();
}

function updateCartDisplay() {
    var imagesContainer = document.getElementById('selectedImagesContainer');
    var videosContainer = document.getElementById('selectedVideosContainer');
    imagesContainer.innerHTML = '';  // Limpa o contêiner existente
    videosContainer.innerHTML = '';  // Limpa o contêiner existente

    let selectedImages = [];
    let selectedVideos = [];

    // Itera sobre todos os itens salvos no LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            if (imagePath.toLowerCase().endsWith('.mp4')) {
                selectedVideos.push({
                    id: imagePath,
                    name: imagePath.split('/').pop()  // Assume que o nome do arquivo é a última parte do caminho
                });
            } else {
                selectedImages.push({
                    id: imagePath,
                    name: imagePath.split('/').pop()  // Assume que o nome do arquivo é a última parte do caminho
                });
            }
        }
    }
    updateImageCount();
    updateTotalValue();

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

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image-btn';

            const spanElement = document.createElement('span');
            spanElement.textContent = 'X';
            spanElement.className = 'span_remove';

            removeBtn.onclick = function () {
                removeFromCart(imageObj.id, imgContainer);  // Define a ação para remover da seleção
            };

            removeBtn.appendChild(spanElement);

            imgContainer.appendChild(imgElement);
            imgContainer.appendChild(removeBtn);

            carouselContainer.appendChild(imgContainer);
        });

        imagesContainer.appendChild(carouselContainer);
    }

    if (selectedVideos.length > 0) {
        const videosList = document.createElement('ul');
        videosList.className = 'videos-list';

        selectedVideos.forEach((videoObj) => {
            const videoItem = document.createElement('li');
            videoItem.className = 'video-item';

            const videoName = document.createElement('span');
            videoName.textContent = videoObj.name;
            videoName.className = 'video-name';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-video-btn';

            const spanElement = document.createElement('span');
            spanElement.textContent = 'X';
            spanElement.className = 'span_remove';

            removeBtn.onclick = function () {
                removeFromCart(videoObj.id, videoItem);  // Define a ação para remover da seleção
            };

            removeBtn.appendChild(spanElement);

            videoItem.appendChild(videoName);
            videoItem.appendChild(removeBtn);

            videosList.appendChild(videoItem);
        });

        videosContainer.appendChild(videosList);
    }
}

function removeFromCart(imagePath, itemContainer) {
    localStorage.removeItem(imagePath);
    itemContainer.remove();  // Remove o contêiner do DOM
    updateCheckmarks();  // Atualiza todos os checkmarks após a remoção
    updateTotalValue();
    updateImageCount();
    updateCartDisplay();  // Atualiza o carrinho após remover item
}

let eventValueConfig = {};

fetch('/load-config')
    .then(response => response.json())
    .then(data => {
        eventValueConfig = data;
        console.log('Configuração de valor do evento carregada:', eventValueConfig);
    });

function getCurrentSubfolder() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.trim() !== '');
    if (segments.length > 1 && segments[0] === "eventos") {
        return decodeURIComponent(segments[1]);  // Retorna o nome da subpasta decodificado
    }
    return '';  // Retorna vazio se não for encontrado
}

function updateTotalValue() {
    let imageCount = 0;
    let videoCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            if (typeof imagePath === 'string' && imagePath.toLowerCase().endsWith('.mp4')) {
                videoCount++;
            } else {
                imageCount++;
            }
        }
    }

    let pricePerImage = 0;
    const event_folder_name = getCurrentSubfolder();
    const valueType = eventValueConfig[event_folder_name] || 'tabela01';
    console.log('Calculando valor para:', event_folder_name, 'com tipo de valor:', valueType);

    // Calcula o preço por imagem
    if (valueType === 'tabela02') {
        if (imageCount >= 1 && imageCount <= 9) {
            pricePerImage = 25.00;
        } else if (imageCount >= 10 && imageCount <= 19) {
            pricePerImage = 22.50;
        } else if (imageCount >= 20) {
            pricePerImage = 20.00;
        }
    } else if (valueType === 'tabela03') {
        pricePerImage = 20.00;
    } else {
        if (imageCount >= 1 && imageCount <= 9) {
            pricePerImage = 20.00;
        } else if (imageCount >= 10 && imageCount <= 19) {
            pricePerImage = 17.50;
        } else if (imageCount >= 20) {
            pricePerImage = 15.00;
        }
    }

    // Calcula o preço por vídeo
    let pricePerVideo = 0;
    if (valueType === 'tabela01') {
        if (videoCount >= 1 && videoCount <= 2) {
            pricePerVideo = 45.00;
        } else if (videoCount >= 3 && videoCount <= 5) {
            pricePerVideo = 40.00;
        } else if (videoCount >= 6) {
            pricePerVideo = 35.00;
        }
    } else if (valueType === 'tabela02') {
        if (videoCount >= 1 && videoCount <= 2) {
            pricePerVideo = 50.00;
        } else if (videoCount >= 3 & videoCount <= 5) {
            pricePerVideo = 45.00;
        } else if (videoCount >= 6) {
            pricePerVideo = 40.00;
        }
    }

    // Certifique-se de que pricePerImage e pricePerVideo são números antes de calcular o total
    pricePerImage = parseFloat(pricePerImage) || 0;
    pricePerVideo = parseFloat(pricePerVideo) || 0;
    const totalValue = (imageCount * pricePerImage) + (videoCount * pricePerVideo);

    // Verifique se totalValue é um número válido
    if (!isNaN(totalValue)) {
        document.getElementById('totalValue').value = `R$ ${totalValue.toFixed(2)}`;
        console.log('Total calculado:', totalValue);
    } else {
        console.error('Erro ao calcular o valor total. Verifique os valores de entrada.');
        document.getElementById('totalValue').value = 'R$ 0.00';
    }
}

function updateImageCount() {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            count++;
        }
    }

    const cartCounters = document.querySelectorAll('.cart-counter');
    cartCounters.forEach(counter => {
        counter.textContent = count;
    });
}

function showCheckoutScreen() {
    document.getElementById('selectedItemsScreen').style.display = 'none';
    document.getElementById('checkoutScreen').style.display = 'block';
}

function showStep(step) {
    document.querySelectorAll('.step').forEach(function (stepElement) {
        stepElement.classList.remove('active');
    });
    document.getElementById('step' + step).classList.add('active');
}

function mascara(i) {
    var v = i.value;

    if (isNaN(v[v.length - 1])) { // impede entrar outro caractere que não seja número
        i.value = v.substring(0, v.length - 1);
        return;
    }

    i.setAttribute("maxlength", "14");
    if (v.length == 3 || v.length == 7) i.value += ".";
    if (v.length == 11) i.value += "-";
}

document.addEventListener('DOMContentLoaded', function () {
    const cepInput = document.getElementById('cep');

    if (cepInput) {
        cepInput.addEventListener('blur', function () {
            const cep = this.value.replace(/\D/g, ''); // Remove caracteres não numéricos
            preencherEndereco(cep);
        });
    }
});

var makeMask = function (mask, $this) {
    if (mask === 'mail') {
        $this.inputmask("email");
    }
}

function validateForm() {
    let isValid = true;

    // Lista de campos a serem validados
    const fields = [
        'name', 'cpf', 'email', 'cep', 'numero'
    ];

    // Percorre cada campo para verificar se está preenchido
    fields.forEach(field => {
        const input = document.getElementById(field);
        const errorSpan = document.getElementById(`${field}-error`);

        if (!input.value) {
            errorSpan.textContent = 'Campo obrigatório';
            isValid = false;
        } else {
            errorSpan.textContent = '';
        }
    });

    if (isValid) {
        displaySuccessNotification();
    }
}

function displaySuccessNotification() {
    toastr.success('Você será direcionada para o WhatsApp para concluir sua compra!', 'Compra Finalizada', { timeOut: 5000 });
    setTimeout(() => {
        sendToWhatsApp();
    }, 5000);
}

function whatsapp() {
    sendToWhatsApp()
}

function sendToWhatsApp() {
    const name = document.getElementById('name') ? document.getElementById('name').value : '';
    const phone = document.getElementById('phone') ? document.getElementById('phone').value : '';
    const email = document.getElementById('email') ? document.getElementById('email').value : '';
    const cpf = document.getElementById('cpf') ? document.getElementById('cpf').value : '';
    const rua = document.getElementById('rua') ? document.getElementById('rua').value : '';
    const cep = document.getElementById('cep') ? document.getElementById('cep').value : '';
    const numero = document.getElementById('numero') ? document.getElementById('numero').value : '';
    const bairro = document.getElementById('bairro') ? document.getElementById('bairro').value : '';
    const cidade = document.getElementById('cidade') ? document.getElementById('cidade').value : '';
    const estado = document.getElementById('estado') ? document.getElementById('estado').value : '';
    const currentFolderName = getCurrentSubfolder();

    let imageNames = [];
    let videoNames = [];
    let imageCount = 0;
    let videoCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            const itemName = decodeURIComponent(imagePath.split('/').pop());
            if (imagePath.toLowerCase().endsWith('.mp4')) {
                videoNames.push(itemName);
                videoCount++;
            } else {
                imageNames.push(itemName);
                imageCount++;
            }
        }
    }

    let message = `*Resumo do Pedido* \n\n`;
    message += `*Evento*: ${currentFolderName}\n\n`;
    message += `*Nome*: ${name}\n\n*Email*: ${email}\n\n`;
    message += `*CPF*: ${cpf}\n\n`;
    message += `*Endereço*: ${rua}, ${numero} - ${bairro}, ${cidade}, ${estado}, CEP: ${cep}\n\n`;
    message += `*Imagens Selecionadas:* ${imageCount} \n ${imageNames.join(',\n ')}\n\n`;
    message += `*Vídeos Selecionados:* ${videoCount} \n ${videoNames.join(',\n ')}\n\n`;
    message += `*Total do Pedido:* ${document.getElementById('totalValue').value}\n\n`;

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
        updateCartDisplay();
    }, 300000); // 300000 milissegundos = 5 minutos
}


// Adiciona um listener para o campo de CEP para autocompletar o endereço
document.getElementById('cep').addEventListener('blur', function () {
    const cep = this.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    preencherEndereco(cep);
});

function preencherEndereco(cep) {
    if (cep.length !== 8) {
        return; // CEP inválido
    }

    const url = `https://viacep.com.br/ws/${cep}/json/`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (!data.erro) {
                document.getElementById('rua').value = data.logradouro;
                document.getElementById('bairro').value = data.bairro;
                document.getElementById('cidade').value = data.localidade;
                document.getElementById('estado').value = data.uf;
            } else {
                alert('CEP não encontrado.');
            }
        })
        .catch(error => {
            console.error('Erro ao buscar o CEP:', error);
            alert('Erro ao buscar o CEP. Tente novamente mais tarde.');
        });
}


// Função para converter a chave VAPID pública de Base64URL para Uint8Array
function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4); // Ajusta para comprimento múltiplo de 4
    const base64 = (base64String + padding)
        .replace(/-/g, '+') // Converte de base64url para base64 padrão
        .replace(/_/g, '/');
    const rawData = window.atob(base64); // Decodifica a string base64 para binário
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Registrar o Service Worker e inicializar o PushManager
if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(registration) {
        console.log('Service Worker registrado com sucesso:', registration);

        // Cancelar a inscrição existente antes de tentar uma nova inscrição
        registration.pushManager.getSubscription().then(function(subscription) {
          if (subscription) {
            return subscription.unsubscribe();
          }
        }).then(function() {
          // Agora inscreva-se novamente
          initializePushManager(registration);
        }).catch(function(error) {
          console.error('Erro ao cancelar a inscrição existente:', error);
        });
      }).catch(function(error) {
        console.error('Falha ao registrar Service Worker:', error);
      });
}

function initializePushManager(registration) {
    const vapidPublicKey = "BO8JMOcEZWU8ycbE-UZRZD0r5Q-lQy28f5DZMUaF_vFV_NDagvj6Xc7OQz5cBj0CpYamkH9q-ab7dfctrglde00";
    const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);
    
    registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
    }).then(function(subscription) {
        console.log('Usuário inscrito com sucesso:', subscription);
        saveSubscription(subscription);
    }).catch(function(error) {
        console.error('Falha ao se inscrever:', error);
    });
}

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function saveSubscription(subscription) {
    fetch('/subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
    }).then(function(response) {
        if (response.ok) {
            console.log('Inscrição salva com sucesso.');
        } else {
            console.error('Falha ao salvar inscrição.');
        }
    }).catch(function(error) {
        console.error('Erro ao enviar a subscrição:', error);
    });
}


