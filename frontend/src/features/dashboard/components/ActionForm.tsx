import React, { useState } from "react";
import helpaBlueLogo from "../../../assets/helpa-logo-blue.svg";
import type { Action, ActionStatus, ActionType } from "../types";
import { ACTION_AREAS, ACTION_TYPES, ACTION_FORMATS } from "../constants";
import { ImagePlus, X, ArrowRight, ArrowLeft, Check, Eye } from "lucide-react";

interface ActionRegisterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActionRegister({ isOpen, onClose }: ActionRegisterProps) {
  const [step, setStep] = useState(1);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [area, setArea] = useState("");
  const [type, setType] = useState("");

  const [date, setDate] = useState("");
  const [workload, setWorkload] = useState("");
  const [spots, setSpots] = useState("");
  const [format, setFormat] = useState("");
  const [location, setLocation] = useState("");
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSuccessConfirm, setShowSuccessConfirm] = useState(false);

  if (!isOpen && !showSuccessConfirm && !showCancelConfirm) return null;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 1) {
      setStep(2);
    } 
    
    else {
      const newAction: Omit<Action, "id"> = {
        title: title,
        description: description,
        image: image,
        location: location,
        date: date,
        workload: Number(workload),
        format: format,
        spots: Number(spots),
        type: type as ActionType,
        status: "available" as ActionStatus,
        cep: Number(cep),
        city: city,
        state: state,
        area: area || undefined,
      };

      console.log("Enviando ação completa:", newAction);
      setShowSuccessConfirm(true);
      
      setStep(1);
      setTitle("");
      setDescription("");
      setImage("");
      setArea("");
      setType("");
      setDate("");
      setWorkload("");
      setSpots("");
      setFormat("");
      setLocation("");
      setCep("");
      setCity("");
      setState("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 backdrop-blur-sm">
      <div className="bg-[#E0E0E0] rounded-2xl w-full max-w-4xl p-4 flex gap-4 relative shadow-2xl m-4">
        
        <div className="w-1/3 bg-[#002147CC] rounded-xl py-6 text-white flex flex-col justify-between relative overflow-hidden min-h-[450px]">
          <div className="flex flex-col gap-8 z-10">
            <span className="text-sm font-semibold tracking-wide px-[28px] pt-[40px] block">
              Vamos criar uma ação?
            </span>
            
            <div className="flex flex-col px-[30px] gap-6 relative">
              <div className="flex items-center gap-4">
                <div className={`size-8 rounded-full shrink-0 flex items-center justify-center font-bold text-sm transition-colors ${step === 1 ? 'bg-white text-[#0A2540]' : 'bg-[#002147] text-white'}`}>
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Identificação</h4>
                  <p className="text-xs opacity-60">Dê um nome para a sua ação</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`size-8 rounded-full shrink-0 flex items-center justify-center font-bold text-sm transition-colors ${step === 2 ? 'bg-white text-[#0A2540]' : 'border-2 border-white/40 text-white/40'}`}>
                  2
                </div>
                <div>
                  <h4 className={`font-semibold text-sm ${step === 2 ? 'text-white' : 'text-white/40'}`}>Logística</h4>
                  <p className="text-xs opacity-60">Conte-nos onde e quando será</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center opacity-20 pointer-events-none my-4" >
            <img src={helpaBlueLogo} alt="helpa" className="h-60 w-auto object-contain select-none" />
          </div>
        </div>

        <div className="flex-1 bg-[#FFF7F7] rounded-xl p-8 flex flex-col justify-between">
          <form onSubmit={handleNext} className="h-full flex flex-col justify-between gap-6">
            
            {step === 1 ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-[#0A2540]">Dê um nome para a sua ação</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título da ação</label>
                  <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Digite o título da sua ação"
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição completa <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva a sua ação"
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] resize-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imagem de capa</label>
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 hover:border-[#1B75BB] transition-colors group bg-white">
                    <ImagePlus className="size-8 text-gray-400 group-hover:text-[#1B75BB] transition-colors" />
                    <div className="text-center">
                      <p className="text-xs font-semibold text-gray-600">
                        {image ? `Selecionado: ${image}` : "Clique para fazer o upload"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG ou JPEG</p>
                    </div>
                    <input 
                      type="file"
                      accept="image/*"
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setImage(e.target.files[0].name);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <select 
                      value={area} 
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#1B75BB]"
                      required
                    >
                      <option value="">Área de atuação</option>
                      {ACTION_AREAS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select 
                      value={type} 
                      onChange={(e) => setType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#1B75BB]"
                      required
                    >
                      <option value="">Tipo de evento</option>
                      {ACTION_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-[#0A2540]">Conte-nos onde e quando será</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carga horária total</label>
                    <input
                      type="number"
                      value={workload}
                      onChange={(e) => setWorkload(e.target.value)}
                      placeholder="ex: 12"
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de vagas</label>
                    <input
                      type="number"
                      value={spots}
                      onChange={(e) => setSpots(e.target.value)}
                      placeholder="ex: 12"
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-600"
                      required
                    />
                  </div>
                </div>

                <div className="w-1/2">
                  <select 
                    value={format} 
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#1B75BB]"
                    required
                  >
                    <option value="">Formato da ação</option>
                    {ACTION_FORMATS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <h3 className="text-base font-semibold text-[#0A2540] mt-2">Endereço</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                  <input 
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="ex: Rua Dois, Bairro Jardim"
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-600"
                  />
                </div>

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                    <input 
                      type="text"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-600"
                    />
                  </div>
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="ex: Bom Jesus"
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-600"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <input 
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="ex: AL"
                      maxLength={2}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-600 uppercase"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-6 w-full">
              
              <button 
                type="button" 
                onClick={() => setShowCancelConfirm(true)}
                className="px-5 py-2 bg-[#4A0E0E] text-white rounded-full text-xs font-semibold flex items-center gap-1 hover:bg-red-900 transition-colors shadow-sm"
              >
                <X className="size-3" /> Cancelar
              </button>

              {step === 1 ? (
                <button 
                  type="submit"
                  className="px-6 py-2 bg-[#002147] text-white rounded-full text-xs font-semibold flex items-center gap-1 hover:bg-[#1B75BB] transition-colors shadow-sm"
                >
                  Próximo <ArrowRight className="size-3" />
                </button>
              ) : (
                <div className="flex items-center gap-4">
                  <button 
                    type="button" 
                    onClick={() => setStep(1)}
                    className="px-5 py-2 bg-[#002147] text-white rounded-full text-xs font-semibold flex items-center gap-1 hover:bg-[#1B75BB] transition-colors shadow-sm"
                  >
                    <ArrowLeft className="size-3" /> Voltar
                  </button>
                  
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-[#05442A] text-white rounded-full text-xs font-semibold flex items-center gap-1 hover:bg-green-800 transition-colors shadow-sm"
                  >
                    Criar ação <Check className="size-3.5 stroke-[3]" />
                  </button>
                </div>
              )}

            </div>

          </form>
        </div>

      </div>

      {showCancelConfirm && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex justify-center items-center z-55 rounded-2xl animate-fade-in">
          <div className="bg-[#FFF7F7] rounded-2xl w-full max-w-sm p-8 flex flex-col items-center justify-center text-center shadow-xl border border-gray-100 m-4">
            
            <div className="bg-[#4A0E0E] text-white p-2 rounded-lg mb-4 flex items-center justify-center size-10">
              <X className="size-6 stroke-[3]" />
            </div>

            <h3 className="text-xl font-bold text-[#002147] leading-snug max-w-[200px] mb-6">
              Criação de ação cancelada
            </h3>

            <button
              type="button"
              onClick={() => {
                setShowCancelConfirm(false); 
                setStep(1);               
                onClose();
              }}
              className="w-full bg-[#002147] text-white py-3 px-6 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#1B75BB] transition-colors shadow-md"
            >
              <ArrowLeft className="size-4" /> Voltar para feed
            </button>

          </div>
        </div>
      )}

      {showSuccessConfirm && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex justify-center items-center z-55 rounded-2xl">
          <div className="bg-[#FFF7F7] rounded-2xl w-full max-w-sm p-8 flex flex-col items-center justify-center text-center shadow-xl border border-gray-100 m-4">
            
            <div className="bg-[#05442A] text-white p-2 rounded-lg mb-4 flex items-center justify-center size-10">
              <Check className="size-6 stroke-[3]" />
            </div>

            <h3 className="text-xl font-bold text-[#002147] leading-snug max-w-[240px] mb-6">
              Sua ação foi registrada com sucesso!
            </h3>

            <button
              type="button"
              onClick={() => {
                setShowSuccessConfirm(false);
                setStep(1);
                setTitle("");
                setDescription("");
                setImage("");
                setArea("");
                setType("");
                setDate("");
                setWorkload("");
                setSpots("");
                setFormat("");
                setLocation("");
                setCep("");
                setCity("");
                setState("");
                onClose();
              }}
              className="w-full bg-[#002147] text-white py-3 px-6 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#1B75BB] transition-colors shadow-md"
            >
              <Eye className="size-4" /> Vizualizar no feed
            </button>

          </div>
        </div>
      )}
    </div>
  );
}