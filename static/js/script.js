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
    updateTotalValue();  // Atualiza o valor total quando a seleção muda
    updateCartDisplay(); // Atualiza o carrinho quando a seleção muda
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
    imagesContainer.innerHTML = '';  // Limpa o contêiner existente

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

    // Contagem de imagens selecionadas no localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            imageCount++;
        }
    }

    let pricePerImage = 0;

    // Obtém o nome do evento atual para determinar a tabela
    const eventFolderName = getCurrentSubfolder();
    let valueType = null;

    // Identifica a tabela associada ao evento atual
    for (const [tabela, eventos] of Object.entries(eventValueConfig)) {
        if (eventos.includes(eventFolderName)) {
            valueType = tabela; // Atribui a tabela correta
            break;
        }
    }

    // Caso não encontre uma tabela, usa um valor padrão
    if (!valueType) {
        console.warn(`Evento ${eventFolderName} não associado a nenhuma tabela. Usando Tabela 20 como padrão.`);
        valueType = 'Tabela 25';
    }

    console.log('Calculando valor para:', eventFolderName, 'com tipo de valor:', valueType);

    // Calcula o preço por imagem com base na tabela identificada
    if (valueType === 'Tabela 30FX') {
        pricePerImage = 30.00; // Preço fixo
    } else if (valueType === 'Tabela 25FX') {
        pricePerImage = 25.00; // Preço fixo
    } else if (valueType === 'Tabela 25') {
        if (imageCount >= 1 && imageCount <= 9) {
            pricePerImage = 25.00;
        } else if (imageCount >= 10 && imageCount <= 19) {
            pricePerImage = 22.50;
        } else if (imageCount >= 20) {
            pricePerImage = 20.00;
        }
    } else if (valueType === 'Tabela 15FX') {
        pricePerImage = 15.00; // Preço fixo
    } else if (valueType === 'Tabela 30') {
        // Preços variáveis para Tabela 20
        if (imageCount >= 1 && imageCount <= 9) {
            pricePerImage = 30.00;
        } else if (imageCount >= 10 && imageCount <= 19) {
            pricePerImage = 27.50;
        } else if (imageCount >= 20) {
            pricePerImage = 25.00;
        }
    }

    // Garante que o preço por imagem é válido antes de calcular o total
    pricePerImage = parseFloat(pricePerImage) || 0;
    const totalValue = imageCount * pricePerImage;

    // Atualiza o campo de valor total
    const totalValueElement = document.getElementById('totalValue');
    if (totalValueElement) {
        if (!isNaN(totalValue)) {
            totalValueElement.value = `R$ ${totalValue.toFixed(2)}`;
            console.log('Total calculado:', totalValue);
        } else {
            console.error('Erro ao calcular o valor total. Verifique os valores de entrada.');
            totalValueElement.value = 'R$ 0.00';
        }
    } else {
        console.error('Elemento #totalValue não encontrado.');
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
    toastr.success('Você será direcionada para o WhatsApp para concluir sua compra.', 'Compra Finalizada', { timeOut: 5000 });
    setTimeout(() => {
        sendToWhatsApp();
    }, 5000);
}

function sendToWhatsApp() {
    const name = document.getElementById('name') ? document.getElementById('name').value : '';
    const phone = document.getElementById('telefone') ? document.getElementById('telefone').value : ''; // Atualizado para capturar o telefone
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
    let imageCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const imagePath = localStorage.key(i);
        if (localStorage.getItem(imagePath) === 'selected') {
            const itemName = decodeURIComponent(imagePath.split('/').pop());
            imageNames.push(itemName);
            imageCount++;
        }
    }

    const totalValue = document.getElementById('totalValue').value.replace('R$ ', '');

    const purchaseData = {
        nome: name,
        telefone: phone, // Incluindo o campo telefone
        cpf: cpf,
        email: email,
        cep: cep,
        rua: rua,
        numero: numero,
        bairro: bairro,
        cidade: cidade,
        estado: estado,
        imagens_selecionadas: imageNames,
        total: parseFloat(totalValue),
        nome_evento: currentFolderName // Inclui o nome do evento
    };

    fetch('/finalizar-compra', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(purchaseData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            let message = `*Resumo do Pedido* \n\n`;
            message += `*Evento*: ${currentFolderName}\n\n`;
            message += `*Nome*: ${name}\n\n*Email*: ${email}\n\n`;
            message += `*Telefone*: ${phone}\n\n`; // Incluindo telefone na mensagem do WhatsApp
            message += `*CPF*: ${cpf}\n\n`;
            message += `*Endereço*: ${rua}, ${numero} - ${bairro}, ${cidade}, ${estado}, CEP: ${cep}\n\n`;
            message += `*Imagens Selecionadas:* ${imageCount} \n ${imageNames.join(',\n ')}\n\n`;
            message += `*Total do Pedido:* R$ ${totalValue}\n\n`;

            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/5511986879746?text=${encodedMessage}`;
            
            window.location.href = whatsappUrl;
            
            setTimeout(() => {
                localStorage.clear();
                updateCheckmarks();
                updateTotalValue();
                updateImageCount();
                updateCartDisplay();
            }, 5000);
        } else {
            console.error('Erro ao finalizar a compra:', data.message);
            toastr.error('Erro ao finalizar a compra. Tente novamente.');
        }
    })
    .catch((error) => {
        console.error('Erro ao finalizar a compra:', error);
        toastr.error('Erro ao finalizar a compra. Tente novamente.');
    });
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